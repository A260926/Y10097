import { matchRoute } from './internal/route'
import {
  RequestLike,
  RouteEntry,
  RouteExplain,
  RouteExplainEntry,
  RoutesLike,
} from './types'

const deepFreeze = (value: any): any => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (let key of Object.keys(value)) deepFreeze(value[key])
  }

  return value
}

const toRoutes = (router: RoutesLike): RouteEntry[] =>
  Array.isArray(router) ? router : router.routes

// Deterministic, cross-process 32-bit FNV-1a hash over a string.
const hash = (input: string): string => {
  let h = 0x811c9dc5

  for (let i = 0; i < input.length; i++)
    h = Math.imul(h ^ input.charCodeAt(i), 0x01000193) >>> 0

  return h.toString(16).padStart(8, '0')
}

/**
 * Explains which route a request would hit WITHOUT executing any handler
 * (no before/route/catch/finally stages, no request mutation). Uses the
 * exact same route compilation/matching pipeline as router.fetch.
 */
export const explain = (router: RoutesLike, request: RequestLike): RouteExplain => {
  const url = new URL(request.url)
  const pathname = url.pathname
  const method = request.method

  let matched = false

  const routes: RouteExplainEntry[] = toRoutes(router).map((entry, index) => {
    const [entryMethod, regex, handlers, path = ''] = entry
    const match = matchRoute(entry, method, pathname)
    const isMatch = !!match && !matched

    if (isMatch) matched = true

    return deepFreeze({
      index,
      method: entryMethod ?? '',
      route: path,
      pattern: regex.source,
      handlers: handlers.length,
      matched: isMatch,
      skipped: !(entryMethod == method || entryMethod == 'ALL')
        ? 'method'
        : !match
          ? 'pattern'
          : false,
      params: deepFreeze({ ...(match?.groups || {}) }),
    })
  })

  const match = routes.find(route => route.matched) || null

  return deepFreeze({
    pathname,
    method,
    routes,
    match,
    route: match?.route || null,
    params: match ? { ...match.params } : {},
  })
}

/**
 * Stable fingerprint of the route table. Derived solely from the observable
 * method, cleaned route, compiled pattern source and handler count. It never
 * reads function sources or object identity, so identical registrations
 * produce identical fingerprints across processes; adding/reordering routes
 * changes it.
 */
export const fingerprint = (router: RoutesLike): string => {
  let serialized = ''

  for (let [method, regex, handlers, path = ''] of toRoutes(router))
    serialized += `${method ?? ''}\u0000${path}\u0000${regex.source}\u0000${handlers.length}\u0001`

  return hash(serialized)
}
