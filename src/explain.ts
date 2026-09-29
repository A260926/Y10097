import {
  FingerprintRoute,
  RequestLike,
  RouteCheck,
  RouteEntry,
  RouteExplanation,
  RouterFingerprint,
} from './types'
import { matchRoute } from './route.ignore.shared'

type ExplainableRouter = { routes: RouteEntry[] }

const snapshotRoute = ([method, regex, handlers, path]: RouteEntry): FingerprintRoute => ({
  method: method ?? null,
  route: path ?? '',
  pattern: regex.source,
  handlerCount: handlers?.length ?? 0,
})

// FNV-1a (64-bit) over UTF-8 bytes; stable across processes/runs.
const hash = (input: string): string => {
  const bytes = new TextEncoder().encode(input)
  let h = 0xcbf29ce484222325n
  for (const byte of bytes) {
    h ^= BigInt(byte)
    h = BigInt.asUintN(64, h * 0x100000001b3n)
  }
  return h.toString(16).padStart(16, '0')
}

// explains which route a request would hit, WITHOUT running any handler
// (before/route/catch/finally) or mutating request.query/params/route/proxy.
// uses the exact same route compilation/matching path as fetch.
export const explain = (
  router: ExplainableRouter,
  request: Request | RequestLike,
): RouteExplanation => {
  const url = new URL(request.url)
  const { pathname } = url
  const method = request.method

  const checked: RouteCheck[] = []
  let hit: string | null = null
  let params: Record<string, string> | null = null

  router.routes.forEach((entry, index) => {
    const [entryMethod, regex, , path] = entry
    const methodMatched = entryMethod == method || entryMethod == 'ALL'
    // same exact method+pattern test performed inside fetch
    const patternMatch = matchRoute(entry, method, pathname)
    const matched = !!patternMatch && hit === null

    if (matched) {
      hit = path ?? ''
      params = patternMatch!.groups || {}
    }

    checked.push({
      index,
      method: entryMethod ?? null,
      route: path ?? '',
      pattern: regex.source,
      handlerCount: entry[2]?.length ?? 0,
      methodMatched,
      patternMatched: methodMatched ? !!patternMatch : undefined,
      matched,
      // fetch short-circuits method mismatches before testing the pattern;
      // a later route that also matches is not itself "skipped" (middleware semantics)
      skipped: matched || !!patternMatch
        ? null
        : !methodMatched ? 'method' : 'pattern',
    })
  })

  return Object.freeze({
    pathname,
    method,
    routes: Object.freeze(checked.map((route) => Object.freeze(route))),
    route: hit,
    params,
  })
}

// stable fingerprint of the observable route table:
// method + cleaned route + compiled pattern + handler count only.
// ignores query strings, handler source code and object identity.
export const fingerprint = (router: ExplainableRouter): RouterFingerprint => {
  const routes = router.routes.map(snapshotRoute).map((route) => Object.freeze(route))
  const serialized = JSON.stringify(routes)

  return Object.freeze({
    hash: hash(serialized),
    routeCount: routes.length,
    routes: Object.freeze(routes),
  })
}
