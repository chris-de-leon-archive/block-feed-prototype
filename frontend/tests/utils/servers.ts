import { Context, InnerContext } from "@block-feed/server/trpc"
import * as http from "node:http"
import {
  CreateOpenApiHttpHandlerOptions,
  createOpenApiHttpHandler,
  OpenApiRouter,
} from "trpc-openapi"

export const createAsyncServer = async (server: http.Server) => {
  await new Promise((res) => {
    server.listen(0, "127.0.0.1", () => {
      res(undefined)
    })
  })

  const addr = server.address()
  if (addr == null || typeof addr === "string") {
    throw new Error(`invalid server address: ${addr}`)
  }

  return {
    url: `http://${addr.address}:${addr.port}`,
    address: addr.address,
    port: addr.port,
    close: async () => {
      await new Promise((res, rej) => {
        server.close((err) => {
          if (err != null) {
            rej(err)
            return
          }
          res(undefined)
        })
      })
    },
  }
}

export const createMockApiServer = <TRouter extends OpenApiRouter>(
  ctx: InnerContext,
  opts: Pick<CreateOpenApiHttpHandlerOptions<TRouter>, "router" | "onError">,
) => {
  return http.createServer(
    createOpenApiHttpHandler({
      router: opts.router,
      onError: opts.onError,
      createContext: (opts) => {
        const httpMethod = opts.req.method
        if (httpMethod == null) {
          throw new Error(
            "unexpectedly received null or undefined request method",
          )
        }

        const host = opts.req.headers.host
        if (host == null) {
          throw new Error("unexpectedly received null or undefined host header")
        }

        // https://nodejs.org/docs/latest-v20.x/api/http.html#messageurl
        const url =
          opts.req.url == null ? null : new URL(opts.req.url, `http://${host}`)
        if (url == null) {
          throw new Error("unexpectedly received null or undefined request URL")
        }

        const sourceIp = opts.req.socket.remoteAddress
        if (sourceIp == null) {
          throw new Error("unexpectedly received null or undefined source IP")
        }

        const multiValueHeaders = new Map<string, string[]>()
        const headers = new Map<string, string>()
        Object.entries(opts.req.headers).forEach(([k, v]) => {
          if (typeof v === "string") {
            headers.set(k, v)
          }
          if (Array.isArray(v)) {
            multiValueHeaders.set(k, v)
          }
        })

        const multiValueQueryStringParameters = new Map<string, string[]>()
        const queryStringParameters = new Map<string, string>()
        Array.from(new Set(url.searchParams.keys())).forEach((key) => {
          const results = url.searchParams.getAll(key)
          if (results.length > 1) {
            multiValueQueryStringParameters.set(key, results)
          }
          if (results.length === 1) {
            queryStringParameters.set(key, results[0])
          }
        })

        return {
          inner: ctx,
          req: {
            headers: opts.req.headers,
          },
        } satisfies Pick<Context, "inner"> & {
          req: Pick<Context["req"], "headers">
        }
      },
    }),
  )
}
