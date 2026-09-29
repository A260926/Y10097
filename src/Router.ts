import { compileRoute, matchRoute } from './internal/route'
import {
  IRequest,
  RequestHandler,
  RequestLike,
  RouterOptions,
  RouterType
} from './types'

export const Router = <
  RequestType = IRequest,
  Args extends any[] = any[],
  ResponseType = any
>({ base = '', routes = [], ...other }: RouterOptions<RequestType, Args> = {}): RouterType<RequestType, Args, ResponseType> =>
  ({
    __proto__: new Proxy({}, {
      get: (target: any, prop: string, receiver: object) =>
        (route: string, ...handlers: RequestHandler<RequestType, Args>[]) =>
          routes.push(compileRoute(prop.toUpperCase?.(), route, handlers, base)) && receiver
    }),
    routes,
    ...other,
    async fetch (request: RequestLike, ...args: any) {
      let response,
          match,
          url = new URL(request.url),
          query: Record<string, any> = request.query = { __proto__: null }

      // 1. parse query params
      for (let [k, v] of url.searchParams)
        query[k] = query[k] ? ([] as string[]).concat(query[k], v) : v

      t: try {
        for (let handler of other.before || [])
          if ((response = await handler(request.proxy ?? request, ...args)) != null) break t

        // 2. then test routes
        outer: for (let route of routes)
          if ((match = matchRoute(route, request.method, url.pathname))) {
            request.params = match.groups || {}                                     // embed params in request
            request.route = route[3]                                                // embed route path in request

            for (let handler of route[2])
              if ((response = await handler(request.proxy ?? request, ...args)) != null) break outer
          }
      } catch (err: any) {
        if (!other.catch) throw err
        response = await other.catch(err, request.proxy ?? request, ...args)
      }

      try {
        for (let handler of other.finally || [])
          response = await handler(response, request.proxy ?? request, ...args) ?? response
      } catch(err: any) {
        if (!other.catch) throw err
          response = await other.catch(err, request.proxy ?? request, ...args)
      }

      return response
    },
  } as RouterType<RequestType, Args, ResponseType>)
