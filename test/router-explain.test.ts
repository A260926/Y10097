import { describe, expect, it } from 'bun:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

// these tests run against the BUILT artifacts (dist/), so build first:
//   bun run build && bun test test/router-explain.test.ts
const dist = (...parts: string[]) => path.resolve(import.meta.dir, '..', 'dist', ...parts)
const cjsImport = createRequire(import.meta.url)

const loadBundles = async () => {
  const esm: any = await import(pathToFileURL(dist('explain.mjs')).href)
  const cjs: any = cjsImport(dist('explain.js'))
  const RouterEsm: any = await import(pathToFileURL(dist('Router.mjs')).href)
  const RouterCjs: any = cjsImport(dist('Router.js'))
  const indexEsm: any = await import(pathToFileURL(dist('index.mjs')).href)
  const indexCjs: any = cjsImport(dist('index.js'))
  return { esm, cjs, RouterEsm, RouterCjs, indexEsm, indexCjs }
}

const buildTable = (Router: any) =>
  Router({ base: '/api' })
    .get('/users/:id', () => 'user', () => 'second')
    .post('/users', () => 'created')
    .get('/files/:path+', () => 'file')
    .get('/images/:name.:format?', () => 'image')
    .all('/admin/*', () => 'admin')
    .get('/wild/optional*', () => 'wild')

const toReq = (methodAndPath: string) => {
  let [method, url] = methodAndPath.split(' ')
  if (!url) { url = method; method = 'GET' }
  return { method, url: `https://example.com${url}` }
}

describe('built artifacts expose the explain API', () => {
  it('exports explain/fingerprint from ESM, CJS and the root entry', async () => {
    const { esm, cjs, indexEsm, indexCjs } = await loadBundles()

    for (const ns of [esm, cjs, indexEsm, indexCjs]) {
      expect(typeof ns.explain).toBe('function')
      expect(typeof ns.fingerprint).toBe('function')
    }
  })

  it('explains a hit identically from ESM and CJS builds', async () => {
    const { esm, cjs, RouterEsm, RouterCjs } = await loadBundles()

    const esmResult = esm.explain(buildTable(RouterEsm.Router), toReq('GET /api/users/13?expand=a&expand=b'))
    const cjsResult = cjs.explain(buildTable(RouterCjs.Router), toReq('GET /api/users/13?expand=a&expand=b'))

    for (const result of [esmResult, cjsResult]) {
      expect(result.pathname).toBe('/api/users/13')
      expect(result.method).toBe('GET')
      expect(result.route).toBe('/api/users/:id')
      expect(result.params).toEqual({ id: '13' })
      expect(result.routes).toHaveLength(6)
      expect(result.routes[0].matched).toBe(true)
      expect(result.routes[1].skipped).toBe('method')
      expect(result.routes[1].patternMatched).toBeUndefined()
      expect(result.routes[2].skipped).toBe('pattern')
    }

    expect(cjsResult).toEqual(esmResult)
  })

  it('explains method, greedy, dot and wildcard semantics without running handlers', async () => {
    const { esm, RouterEsm } = await loadBundles()

    const greedy = esm.explain(buildTable(RouterEsm.Router), toReq('GET /api/files/a/b/c'))
    expect(greedy.route).toBe('/api/files/:path+')
    expect(greedy.params).toEqual({ path: 'a/b/c' })

    const image = esm.explain(buildTable(RouterEsm.Router), toReq('GET /api/images/cat.jpg'))
    expect(image.route).toBe('/api/images/:name.:format?')
    expect(image.params).toEqual({ name: 'cat', format: 'jpg' })

    const wildcard = esm.explain(buildTable(RouterEsm.Router), toReq('DELETE /api/admin/x/y'))
    expect(wildcard.route).toBe('/api/admin/*')
    expect(wildcard.params).toEqual({})

    const miss = esm.explain(buildTable(RouterEsm.Router), toReq('GET /nope'))
    expect(miss.route).toBeNull()
    expect(miss.params).toBeNull()
  })

  it('produces stable fingerprints across instances and builds', async () => {
    const { esm, cjs, RouterEsm, RouterCjs } = await loadBundles()

    const esmFp = esm.fingerprint(buildTable(RouterEsm.Router))
    const cjsFp = cjs.fingerprint(buildTable(RouterCjs.Router))

    expect(cjsFp.hash).toBe(esmFp.hash)
    expect(cjsFp).toEqual(esmFp)
    expect(esmFp.routeCount).toBe(6)
    expect(/^[0-9a-f]{16}$/.test(esmFp.hash)).toBe(true)
    expect(esmFp.routes[0]).toEqual({
      method: 'GET',
      route: '/api/users/:id',
      pattern: esmFp.routes[0].pattern,
      handlerCount: 2,
    })

    // adding or reordering changes the fingerprint
    const added = (() => {
      const router = buildTable(RouterEsm.Router)
      router.get('/extra', () => 1)
      return esm.fingerprint(router)
    })()
    expect(added.hash).not.toBe(esmFp.hash)

    // repeated query keys never participate in the fingerprint
    esm.explain(buildTable(RouterEsm.Router), toReq('GET /api/users/1?a=1&a=2'))
    expect(esm.fingerprint(buildTable(RouterEsm.Router)).hash).toBe(esmFp.hash)

    // the snapshot is immutable
    expect(Object.isFrozen(esmFp)).toBe(true)
    expect(Object.isFrozen(esmFp.routes)).toBe(true)
  })

  it('explain snapshots do not change when routes are added later', async () => {
    const { esm, RouterEsm } = await loadBundles()
    const router = RouterEsm.Router()
    router.get('/first', () => 1)

    const first = esm.explain(router, toReq('/first'))
    const firstFp = esm.fingerprint(router)

    router.get('/second', () => 2)
    expect(first.routes).toHaveLength(1)
    expect(first.route).toBe('/first')
    expect(firstFp.routeCount).toBe(1)
    expect(() => {
      // @ts-expect-error frozen snapshot
      first.route = 'changed'
    }).toThrow()
  })

  it('prints the demo: one match explanation + two stable fingerprints', async () => {
    const { esm, RouterEsm } = await loadBundles()
    const routerA = buildTable(RouterEsm.Router)
    const routerB = buildTable(RouterEsm.Router)

    const hit = esm.explain(routerA, toReq('GET /api/users/13'))
    const fpA = esm.fingerprint(routerA)
    const fpB = esm.fingerprint(routerB)

    console.log('\n=== route match explanation ===')
    console.log(JSON.stringify(hit, null, 2))
    console.log('=== stable fingerprints (identical configs, separate instances) ===')
    console.log('instance A:', fpA.hash)
    console.log('instance B:', fpB.hash)

    expect(fpA.hash).toBe(fpB.hash)
  })
})
