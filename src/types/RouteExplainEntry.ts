export type RouteExplainEntry = {
  // registration order within the router (0-based)
  readonly index: number
  // normalized registration method (uppercased), e.g. GET or ALL
  readonly method: string
  // cleaned route string (base applied, double/trailing slashes stripped)
  readonly route: string
  // compiled pattern source, shared with fetch's RegExp
  readonly pattern: string
  // number of handlers registered on the route
  readonly handlers: number
  // true while this entry is the first route that would be hit
  readonly matched: boolean
  // false when checked and not skipped, otherwise the skip reason
  readonly skipped: false | 'method' | 'pattern'
  // named params captured for this entry when the pattern matches
  readonly params: { readonly [key: string]: string }
}
