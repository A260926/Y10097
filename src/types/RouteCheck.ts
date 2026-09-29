export type RouteCheck = {
  // registration order of the route (0-based)
  index: number
  // observable HTTP method token (e.g. "GET"), "ALL", or null
  method: string | null
  // cleaned route string embedded at registration
  route: string
  // source of the compiled pattern, shared with fetch
  pattern: string
  // number of handlers attached to the route
  handlerCount: number
  // false when skipped because of an HTTP method mismatch
  methodMatched: boolean
  // false when skipped because the compiled pattern did not match
  // (undefined when the method itself did not match, mirroring fetch)
  patternMatched?: boolean
  // true only for the first route that matched method AND pattern
  matched: boolean
  // why the route did not match ("method" | "pattern"), or null on match
  skipped: null | 'method' | 'pattern'
}
