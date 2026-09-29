import { FingerprintRoute } from './FingerprintRoute'

export type RouterFingerprint = {
  // deterministic hash of the observable route table
  hash: string
  // number of routes factored into the hash
  routeCount: number
  // stable, cross-process serialization of the route table
  routes: FingerprintRoute[]
}
