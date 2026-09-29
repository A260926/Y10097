import { RouteEntry } from './types'

// shared route compiler - the single source of truth used by both
// route registration (IttyRouter/Router) and the explain API.
export type CompiledRoute = [method: string, regex: RegExp, handlers: any[], path: string]

export const compileRoute = (base: string, method: string, route: string, handlers: any[] = []): CompiledRoute => {
  let path
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

// shared route matcher - mirrors the exact test performed inside fetch
// (method equality or ALL, then the compiled pattern against the pathname).
export const matchRoute = (
  [method, regex]: RouteEntry,
  requestMethod: string,
  pathname: string,
): RegExpMatchArray | null =>
  (method == requestMethod || method == 'ALL')
    ? pathname.match(regex)
    : null
