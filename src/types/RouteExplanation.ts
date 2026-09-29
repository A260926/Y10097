import { RouteCheck } from './RouteCheck'

export type RouteExplanation = {
  // normalized request pathname, as seen by fetch
  pathname: string
  // request method as provided
  method: string
  // every registered route, inspected in registration order
  routes: RouteCheck[]
  // first route string that matched, or null
  route: string | null
  // named params captured by the first match, or null
  params: Record<string, string> | null
}
