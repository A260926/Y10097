import { RouteEntry } from './RouteEntry'

export type RoutesLike = Pick<{ routes: RouteEntry[] }, 'routes'> | RouteEntry[]
