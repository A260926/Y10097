import { describe, expect, it, mock } from 'bun:test'
import { toReq } from '../lib'
import { IttyRouter } from './IttyRouter'
import { Router } from './Router'
import { explain, fingerprint } from './explain'

const RoutersToTest = [
  { routerName: 'IttyRouter', Router: IttyRouter },
  { routerName: 'Router', Router: Router },
]

describe('explain / fingerprint', () => {
  for (const { routerName, Router: MakeRouter } of RoutersToTest) {
    describe(`ROUTER = ${routerName}`, () => {
      const build = () =>
        MakeRouter()
          .get('/foo/static', () => 1)
          .get('/foo/:id', (r) => r.params.id)
          .post('/foo', () => 2)
          .all('/crud/*', () => 3)

      it('reports normalized pathname, method and ordered checks', () => {
        const router = build()
        const result = explain(router, toReq('/foo/13'))

        expect(result.pathname).toBe('/foo/13')
        expect(result.method).toBe('GET')
        expect(result.routes.map((r) => r.index)).toEqual([0, 1, 2, 3])
        expect(result.route).toBe('/foo/:id')
        expect(result.params).toEqual({ id: '13' })
      })

      it('marks the first pattern-matching route as the hit with params', () => {
        const router = build()
        const result = explain(router, toReq('/foo/static'))

        expect(result.route).toBe('/foo/static')
        expect(result.params).toEqual({})
        expect(result.routes[0].matched).toBe(true)
        expect(result.routes[1].matched).toBe(false)
      })

      it('captures named params from the first hit', () => {
        const router = build()
        const result = explain(router, toReq('/foo/42'))

        expect(result.route).toBe('/foo/:id')
        expect(result.params).toEqual({ id: '42' })
        expect(result.routes[0].skipped).toBe('pattern')
        expect(result.routes[0].methodMatched).toBe(true)
        expect(result.routes[0].patternMatched).toBe(false)
      })

      it('skips method mismatches before testing the pattern, like fetch', () => {
        const router = build()
        const result = explain(router, toReq('POST /foo'))

        expect(result.route).toBe('/foo')
        expect(result.params).toEqual({})
        const [staticRoute, idRoute, postRoute, allRoute] = result.routes
        expect(staticRoute.skipped).toBe('method')
        expect(staticRoute.patternMatched).toBeUndefined()
        expect(idRoute.skipped).toBe('method')
        expect(postRoute.matched).toBe(true)
        // pattern was never evaluated for method mismatches
        expect(allRoute.methodMatched).toBe(true)
        expect(allRoute.patternMatched).toBe(false)
        expect(allRoute.skipped).toBe('pattern')
      })

      it('matches ALL routes for any method', () => {
        const router = MakeRouter().all('/crud/*', () => 1)
        const result = explain(router, toReq('DELETE /crud/x'))

        expect(result.route).toBe('/crud/*')
        expect(result.routes[0].method).toBe('ALL')
        expect(result.routes[0].methodMatched).toBe(true)
      })

      it('returns null route/params when nothing matches', () => {
        const router = build()
        const result = explain(router, toReq('/nope'))

        expect(result.route).toBeNull()
        expect(result.params).toBeNull()
        expect(result.routes.every((r) => r.matched === false)).toBe(true)
      })

      it('never runs before/route/catch/finally handlers', async () => {
        const routeHandler = mock()
        const beforeHandler = mock()
        const catchHandler = mock()
        const finallyHandler = mock()
        const router = Router({
          before: [beforeHandler],
          catch: catchHandler,
          finally: [finallyHandler],
        }).get('/foo/:id', routeHandler)

        explain(router, toReq('/foo/13?x=1'))

        expect(routeHandler).not.toHaveBeenCalled()
        expect(beforeHandler).not.toHaveBeenCalled()
        expect(catchHandler).not.toHaveBeenCalled()
        expect(finallyHandler).not.toHaveBeenCalled()
      })

      it('does not mutate request.query/params/route/proxy', () => {
        const router = MakeRouter().get('/foo/:id', () => 1)
        const request: any = toReq('/foo/13?x=1')

        const result = explain(router, request)

        expect(request.query).toBeUndefined()
        expect(request.params).toBeUndefined()
        expect(request.route).toBeUndefined()
        expect(request.proxy).toBeUndefined()
        // result is a detached snapshot
        expect(result.routes).toHaveLength(1)
      })

      it('accepts a minimal RequestLike', () => {
        const router = MakeRouter().get('/foo/:id', () => 1)
        const result = explain(router, { method: 'GET', url: 'https://x.com/foo/9' })

        expect(result.pathname).toBe('/foo/9')
        expect(result.route).toBe('/foo/:id')
        expect(result.params).toEqual({ id: '9' })
      })

      it('follows base path semantics', () => {
        const router = MakeRouter({ base: '/api' }).get('/foo/:id?', () => 1)
        const result = explain(router, toReq('/api/foo/13'))

        expect(result.route).toBe('/api/foo/:id?')
        expect(result.params).toEqual({ id: '13' })
        expect(explain(router, toReq('/api/foo')).route).toBe('/api/foo/:id?')
      })

      it('follows greedy, optional and wildcard semantics', () => {
        const greedy = MakeRouter().get('/foo/:id+', () => 1)
        expect(explain(greedy, toReq('/foo/bar/baz')).params).toEqual({ id: 'bar/baz' })
        expect(explain(greedy, toReq('/foo/bar/baz')).route).toBe('/foo/:id+')
        expect(explain(greedy, toReq('/foo/')).route).toBeNull()

        const optional = MakeRouter().get('/foo/:id?', () => 1)
        expect(explain(optional, toReq('/foo')).route).toBe('/foo/:id?')
        expect(explain(optional, toReq('/foo/7')).params).toEqual({ id: '7' })

        const wildcard = MakeRouter().get('/a/*/b', () => 1)
        expect(explain(wildcard, toReq('/a/x/y/b')).route).toBe('/a/*/b')
      })

      it('follows dot-extension semantics', () => {
        const router = MakeRouter().get('/:id.:format', () => 1)
        expect(explain(router, toReq('/foo.jpg')).params).toEqual({ id: 'foo', format: 'jpg' })
        expect(explain(router, toReq('/fooXjpg')).route).toBeNull()
      })

      it('cleans duplicate and trailing slashes in the stored route', () => {
        const router = MakeRouter().get('//foo//bar//', () => 1)
        const result = explain(router, toReq('/foo/bar'))
        expect(result.routes[0].route).toBe('/foo/bar')
        expect(result.route).toBe('/foo/bar')
      })

      it('returns an immutable snapshot unaffected by later registration', () => {
        const router = MakeRouter().get('/foo', () => 1)
        const first = explain(router, toReq('/foo'))

        router.get('/bar', () => 2)
        const second = explain(router, toReq('/bar'))

        expect(first.routes).toHaveLength(1)
        expect(Object.isFrozen(first)).toBe(true)
        expect(Object.isFrozen(first.routes)).toBe(true)
        expect(Object.isFrozen(first.routes[0])).toBe(true)
        expect(second.routes).toHaveLength(2)
      })
    })
  }

  it('shares the compiled pattern with fetch (no duplicated regex chain)', () => {
    const router = Router().get('/foo/:id.:format?', () => 1)
    const result = explain(router, toReq('/foo/13.jpg'))

    expect(result.routes[0].pattern).toBe(router.routes[0][1].source)
    expect(result.params).toEqual({ id: '13', format: 'jpg' })
  })

  it('agrees with fetch on the first matched route across patterns', async () => {
    const seen: string[] = []
    const router = Router()
      .get('/foo/static', () => seen.push('/foo/static'))
      .get('/foo/:id', () => seen.push('/foo/:id'))
      .all('*', () => seen.push('*'))

    for (const path of ['/foo/static', '/foo/13', '/other']) {
      seen.length = 0
      const hit = explain(router, toReq(path)).route
      await router.fetch(toReq(path))
      expect(hit).toBe(seen[0])
    }
  })

  describe('fingerprint', () => {
    const build = () =>
      Router()
        .get('/foo', () => 1, () => 2)
        .post('/bar/:id', () => 3)

    it('contains only method, cleaned route, pattern and handler count', () => {
      const fp = fingerprint(build())
      expect(fp.routeCount).toBe(2)
      expect(fp.routes).toEqual([
        { method: 'GET', route: '/foo', pattern: fp.routes[0].pattern, handlerCount: 2 },
        { method: 'POST', route: '/bar/:id', pattern: fp.routes[1].pattern, handlerCount: 1 },
      ])
      expect(fp.routes[0].pattern).toBe(Router().get('/foo', () => {}).routes[0][1].source)
    })

    it('is identical for identical registrations (cross-instance)', () => {
      const a = fingerprint(build())
      const b = fingerprint(build())
      expect(a.hash).toBe(b.hash)
      expect(a).toEqual(b)
    })

    it('changes when a route is added, removed or reordered', () => {
      const base = fingerprint(build())
      const added = fingerprint(Router().get('/foo', () => 1, () => 2).post('/bar/:id', () => 3).get('/z', () => 4))
      const reordered = fingerprint(Router().post('/bar/:id', () => 3).get('/foo', () => 1, () => 2))
      const differentHandlers = fingerprint(Router().get('/foo', () => 99, () => 100).post('/bar/:id', () => 101))

      expect(added.hash).not.toBe(base.hash)
      expect(reordered.hash).not.toBe(base.hash)
      // handler source/identity does not matter, only the observable table
      expect(differentHandlers.hash).toBe(base.hash)
    })

    it('ignores query strings and is stable for frozen output', () => {
      const router = build()
      const fp1 = fingerprint(router)
      explain(router, toReq('/foo?a=1&a=2&b=c'))
      const fp2 = fingerprint(router)
      expect(fp1.hash).toBe(fp2.hash)
      expect(Object.isFrozen(fp1)).toBe(true)
      expect(Object.isFrozen(fp1.routes)).toBe(true)
      expect(/^[0-9a-f]{16}$/.test(fp1.hash)).toBe(true)
    })

    it('captures handler count changes', () => {
      const one = fingerprint(Router().get('/foo', () => 1))
      const two = fingerprint(Router().get('/foo', () => 1, () => 2))
      expect(one.hash).not.toBe(two.hash)
      expect(one.routes[0].handlerCount).toBe(1)
      expect(two.routes[0].handlerCount).toBe(2)
    })

    it('works with manually preloaded routes', () => {
      const handler = () => 1
      const router = Router({ routes: [['GET', /^\/custom-(?<id>\d+)$/, [handler], '/custom-:id']] })
      const fp = fingerprint(router)
      expect(fp.routes[0]).toEqual({
        method: 'GET',
        route: '/custom-:id',
        pattern: '^\\/custom-(?<id>\\d+)$',
        handlerCount: 1,
      })
      expect(explain(router, toReq('/custom-123')).params).toEqual({ id: '123' })
    })
  })
})
