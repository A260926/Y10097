import {
  IRequest,
  IttyRouterOptions,
  IttyRouterType,
  RequestHandler,
  RequestLike,
} from './types'
import { compileRoute, matchRoute } from './route.ignore.shared'

export const IttyRouter = <
  RequestType extends IRequest = IRequest,
  Args extends any[] = any[],
  ResponseType = any,
>({ base = '', routes = [], ...other }: IttyRouterOptions = {}): IttyRouterType<RequestType, Args, ResponseType> =>
// @ts-ignore
  ({
    __proto__: new Proxy({}, {
      get: (target: any, prop: string, receiver: object) =>
        (route: string, ...handlers: RequestHandler<RequestType, Args>[]) =>
          routes.push(compileRoute(base, prop.toUpperCase(), route, handlers)) && receiver
    }),
    routes,
    ...other,
    async fetch (request: RequestLike, ...args)  {
      let response,
          match,
          url = new URL(request.url),
          query: Record<string, any> = request.query = { __proto__: null }

      // 1. parse query params
      for (let [k, v] of url.searchParams)
        query[k] = query[k] ? ([] as string[]).concat(query[k], v) : v

      // 2. then test routes
      for (let route of routes)
        if ((match = matchRoute(route, request.method, url.pathname))) {
          const [, , handlers, path] = route
          request.params = match.groups || {}                                     // embed params in request
          request.route = path                                                    // embed route path in request
          for (let handler of handlers)
            if ((response = await handler(request.proxy ?? request, ...args)) != null) return response
        }
    },
  })
