import { describe, expect, it, mock } from 'bun:test'
import { IttyRouter } from '../src/IttyRouter'
import { Router } from '../src/Router'
import { explain, fingerprint } from '../src/explain'
import { RouteExplain, RouteExplainEntry } from '../src/types'

const RoutersToTest = [
  { routerName: 'IttyRouter', Router: IttyRouter },
  { routerName: 'Router', Router: Router },
]

describe('explain() / fingerprint()', () => {
  for (const { routerName, Router: RouterFactory } of RoutersToTest) {
    describe(`ROUTER = ${routerName}`, () => {
      const buildRouter = () => {
        const router = RouterFactory({ base: '/api' })
        router
          .get('/foo/:id', () => 'one', () => 'two')
          .post('/foo/:id', () => 'three')
          .all('/wild/*', () => 'four')
          .get('/g/:x+', () => 'five')
          .get('/dot.:ext?', () => 'six')
        return router
      }

      it('normalizes pathname/method and reports the first hit with params', () => {
        const result = explain(buildRouter(), {
          method: 'GET',
          url: 'https://example.com/api/foo/13?foo=bar&foo=baz',
        })

        expect(result.pathname).toBe('/api/foo/13')
        expect(result.method).toBe('GET')
        expect(result.route).toBe('/api/foo/:id')
        expect(result.params).toEqual({ id: '13' })
        expect(result.match?.params).toEqual({ id: '13' })
        expect(result.match?.handlers).toBe(2)
      })

      it('lists every checked route in registration order with skip reasons', () => {
        const result = explain(buildRouter(), {
          method: 'GET',
          url: 'https://example.com/api/foo/13',
        })

        expect(result.routes.map(r => r.route)).toEqual([
          '/api/foo/:id',
          '/api/foo/:id',
          '/api/wild/*',
          '/api/g/:x+',
          '/api/dot.:ext?',
        ])
        expect(result.routes.map(r => r.skipped)).toEqual([
          false,
          'method',
          'pattern',
          'pattern',
          'pattern',
        ])
        expect(result.routes.map(r => r.index)).toEqual([0, 1, 2, 3, 4])
        expect(result.routes.filter(r => r.matched)).toHaveLength(1)
      })

      it('honors ALL routes and stops at the first matching route', () => {
        const result = explain(buildRouter(), {
          method: 'DELETE',
          url: 'https://example.com/api/wild/thing/extra',
        })

        expect(result.route).toBe('/api/wild/*')
        expect(result.match?.method).toBe('ALL')
        expect(result.params).toEqual({})
        // later matching pattern is still not the first hit
        const greedy = result.routes.find(r => r.route === '/api/g/:x+')
        expect(greedy?.matched).toBe(false)
        expect(greedy?.skipped).toBe('method')
      })

      it('explains greedy params, named params and dots through the shared compiler', () => {
        const greedy = explain(buildRouter(), {
          method: 'GET',
          url: 'https://example.com/api/g/a/b/c',
        })
        expect(greedy.params).toEqual({ x: 'a/b/c' })

        const dot = explain(buildRouter(), {
          method: 'GET',
          url: 'https://example.com/api/dot.jpg',
        })
        expect(dot.params).toEqual({ ext: 'jpg' })

        const noDot = explain(buildRouter(), {
          method: 'GET',
          url: 'https://example.com/api/dot',
        })
        expect(noDot.route).toBe('/api/dot.:ext?')
        expect(noDot.params).toEqual({})
      })

      it('follows fetch semantics for trailing/double slashes and base "/"', () => {
        const router = RouterFactory({ base: '/' })
        // double/trailing slashes in the route are cleaned by the shared compiler
        router.get('/foo//:id//', () => 1)

        const result = explain(router, {
          method: 'GET',
          url: 'https://example.com/foo/13/',
        })
        expect(result.match?.route).toBe('/foo/:id')
        expect(result.params).toEqual({ id: '13' })

        const trailing = explain(
          RouterFactory({ base: '/' }).get('/foo/:id?', () => 1),
          { method: 'GET', url: 'https://example.com/foo/' },
        )
        expect(trailing.route).toBe('/foo/:id?')
      })

      it('reports no match when no route is hit', () => {
        const result = explain(buildRouter(), {
          method: 'GET',
          url: 'https://example.com/nope',
        })

        expect(result.route).toBeNull()
        expect(result.match).toBeNull()
        expect(result.params).toEqual({})
        expect(result.routes.every(r => !r.matched)).toBe(true)
      })

      it('never executes handlers or mutates the request', async () => {
        const handler = mock(() => 'never')
        const before = mock(() => {})
        const after = mock(() => {})
        const router = RouterFactory({
          before: [before],
          finally: [after],
        } as any)
        router.get('/foo/:id', handler)

        const request: any = { method: 'GET', url: 'https://example.com/foo/13?z=1' }
        const snapshot = explain(router, request)

        expect(handler).not.toHaveBeenCalled()
        expect(before).not.toHaveBeenCalled()
        expect(after).not.toHaveBeenCalled()
        expect(request.query).toBeUndefined()
        expect(request.params).toBeUndefined()
        expect(request.route).toBeUndefined()
        expect(request.proxy).toBeUndefined()

        // fetch still behaves as usual afterwards
        const response = await (router as any).fetch(
          { method: 'GET', url: 'https://example.com/foo/13' },
        )
        expect(handler).toHaveBeenCalledTimes(1)
        expect(response).toBe('never')
        expect(snapshot.route).toBe('/foo/:id')
      })

      it('returns an immutable snapshot unaffected by later registration', () => {
        const router = buildRouter()
        const snapshot = explain(router, {
          method: 'GET',
          url: 'https://example.com/api/foo/13',
        })

        expect(Object.isFrozen(snapshot)).toBe(true)
        expect(Object.isFrozen(snapshot.routes)).toBe(true)
        expect(Object.isFrozen(snapshot.routes[0])).toBe(true)
        expect(Object.isFrozen(snapshot.routes[0].params)).toBe(true)

        expect(() => {
          ;(snapshot as any).route = '/changed'
        }).toThrow()
        expect(() => {
          ;(snapshot.routes as any).push(null)
        }).toThrow()
        expect(() => {
          ;(snapshot.routes[0] as any).matched = false
        }).toThrow()

        router.get('/late/:x', () => 'late')
        expect(snapshot.routes).toHaveLength(5)
        expect(snapshot.route).toBe('/api/foo/:id')
      })
    })
  }

  it('produces stable cross-process fingerprints from observable data only', () => {
    const make = () => {
      const router = Router({ base: '/api' })
      router
        .get('/foo/:id', () => Math.random(), () => 1)
        .post('/foo/:id', () => ({}))
        .all('/wild/*', () => null)
      return router
    }

    const a = fingerprint(make())
    const b = fingerprint(make())

    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(a).toBe(b)
  })

  it('fingerprint changes when routes are added or reordered', () => {
    const router = Router()
    router.get('/a', () => 1).get('/b', () => 2)
    const base = fingerprint(router)

    router.get('/c', () => 3)
    expect(fingerprint(router)).not.toBe(base)

    const reordered = Router()
    reordered.get('/b', () => 2).get('/a', () => 1).get('/c', () => 3)
    expect(fingerprint(reordered)).not.toBe(fingerprint(router))
  })

  it('fingerprint ignores handler identity/source but counts handlers and ignores query', () => {
    const router1 = Router()
    const router2 = Router()
    const fn = () => 1
    router1.get('/a', fn, fn)
    router2.get('/a', () => 1, () => 2)

    expect(fingerprint(router1)).toBe(fingerprint(router2))

    // same path, different handler count -> different fingerprint
    const router3 = Router()
    router3.get('/a', () => 1)
    expect(fingerprint(router3)).not.toBe(fingerprint(router1))

    // query strings are not part of the route table
    expect(fingerprint(router1)).toBe(fingerprint(router1))
  })

  it('accepts a raw RouteEntry[] (preloaded routes)', () => {
    const router = Router({
      routes: [
        ['GET', /^\/test\.(?<x>[^/]+)\/*$/, [() => 1], '/test'],
      ],
    })

    const result = explain(router, { method: 'GET', url: 'https://x.com/test.a.b' })
    expect(result.route).toBe('/test')
    expect(result.params).toEqual({ x: 'a.b' })
    expect(result.match?.pattern).toBe('^\\/test\\.(?<x>[^/]+)\\/*$')
    expect(result.match?.handlers).toBe(1)
  })

  it('works with a real Request object', () => {
    const router = Router().get('/foo/:id', () => 1)
    const result = explain(router, new Request('https://example.com/foo/7?q=1'))

    expect(result.method).toBe('GET')
    expect(result.pathname).toBe('/foo/7')
    expect(result.params).toEqual({ id: '7' })
  })

  it('demo: prints a hit explanation and two stable fingerprints', () => {
    const router = Router()
    router
      .get('/users/:id+', () => 'user')
      .post('/users', () => 'create')
      .all('*', () => 'missing')

    const result: RouteExplain = explain(
      router,
      new Request('https://api.example.com/users/13/profile?debug=1&debug=2'),
    )

    const fingerprintA = fingerprint(router)
    const routerB = Router()
    routerB
      .get('/users/:id+', () => 'other')
      .post('/users', () => 'other')
      .all('*', () => 'other')
    const fingerprintB = fingerprint(routerB)

    console.log('hit explanation:', JSON.stringify(result, null, 2))
    console.log('fingerprint A:', fingerprintA)
    console.log('fingerprint B:', fingerprintB)

    const first: RouteExplainEntry | null = result.match
    expect(first?.route).toBe('/users/:id+')
    expect(result.params).toEqual({ id: '13/profile' })
    expect(result.routes.map(r => r.skipped)).toEqual([
      false,
      'method',
      false,
    ])
    expect(result.routes[2].matched).toBe(false)
    expect(fingerprintA).toBe(fingerprintB)
  })
})
