import { RequestHandler } from '../types'
import { RouteEntry } from '../types'

// This is the single route compilation pipeline. Both the routers (at
// registration time) and the opt-in explain/fingerprint APIs consume it,
// so the regex replacement chain can never drift between matching paths.
export const compileRoute = (
  method: string,
  route: string,
  handlers: RequestHandler[],
  base = '',
): RouteEntry => {
  let path: string

  return [
    method,
    RegExp(`^${(path = (base + route)
      .replace(/\/+(\/|$)/g, '$1'))                       // strip double & trailing splash
      .replace(/(\/?\.?):(\w+)\+/g, '($1(?<$2>[^]+))')    // greedy params
      .replace(/(\/?\.?):(\w+)/g, '($1(?<$2>[^$1/]+?))')  // named params and image format
      .replace(/\./g, '\\.')                              // dot in path
      .replace(/(\/?)\*/g, '($1.*)?')                     // wildcard
    }/*$`),
    handlers,
    path,
  ]
}

// Shared route test, mirroring fetch semantics exactly:
// the route method must match the request method (or be ALL) and the
// compiled pattern must match the request pathname.
export const matchRoute = (
  [method, regex]: RouteEntry,
  requestMethod: string,
  pathname: string,
): RegExpMatchArray | null =>
  (method == requestMethod || method == 'ALL')
    ? pathname.match(regex)
    : null
