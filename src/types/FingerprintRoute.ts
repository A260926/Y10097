export type FingerprintRoute = {
  // observable HTTP method token (e.g. "GET"), "ALL", or null
  // for custom non-method channels
  method: string | null
  route: string
  pattern: string
  handlerCount: number
}
