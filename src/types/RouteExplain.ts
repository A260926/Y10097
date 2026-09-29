import { RouteExplainEntry } from './RouteExplainEntry'

export type RouteExplain = {
  // normalized request pathname (URL.pathname)
  readonly pathname: string
  // request method used for matching
  readonly method: string
  // every registered route, in registration order
  readonly routes: readonly RouteExplainEntry[]
  // the first route that would be hit (identical to routes[index])
  readonly match: RouteExplainEntry | null
  // cleaned route string of the first hit, e.g. /foo/:id
  readonly route: string | null
  // params of the first hit
  readonly params: { readonly [key: string]: string }
}
