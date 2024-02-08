import { CreateOpenApiHttpHandlerOptions, OpenApiRouter } from "trpc-openapi"
import { createOpenApiHttpHandler } from "trpc-openapi"
import { APIGatewayEvent, Context } from "aws-lambda"
import { randomUUID } from "node:crypto"
import * as http from "node:http"

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

export const createMockApiServer = <TRouter extends OpenApiRouter, TContext>(
  ctx: TContext,
  opts: Pick<CreateOpenApiHttpHandlerOptions<TRouter>, "router" | "onError">,
) => {
  return http.createServer(
    createOpenApiHttpHandler({
      router: opts.router,
      onError: opts.onError,
      createContext: async (opts) => {
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

        // https://www.serverless.com/framework/docs/providers/aws/events/apigateway#example-lambda-proxy-event-default
        // https://trpc.io/docs/rpc#methods---type-mapping
        const event: APIGatewayEvent = {
          body: "", // API doesn't need to access this property
          headers: Object.fromEntries(headers),
          multiValueHeaders: Object.fromEntries(multiValueHeaders),
          httpMethod,
          isBase64Encoded: false,
          path: url.pathname,
          pathParameters: {},
          queryStringParameters: Object.fromEntries(queryStringParameters),
          multiValueQueryStringParameters: Object.fromEntries(
            multiValueQueryStringParameters,
          ),
          stageVariables: {},
          requestContext: {
            accountId: "",
            apiId: "",
            authorizer: {},
            protocol: url.protocol,
            httpMethod,
            identity: {
              accessKey: null,
              accountId: null,
              apiKey: null,
              apiKeyId: null,
              caller: null,
              clientCert: null,
              cognitoAuthenticationProvider: null,
              cognitoAuthenticationType: null,
              cognitoIdentityId: null,
              cognitoIdentityPoolId: null,
              principalOrgId: null,
              user: null,
              userAgent: null,
              userArn: null,
              sourceIp,
            },
            path: url.pathname,
            stage: "",
            requestId: randomUUID(),
            requestTimeEpoch: 1,
            resourceId: "",
            resourcePath: "",
          },
          resource: "",
        }

        const context: Context = {
          callbackWaitsForEmptyEventLoop: false,
          functionName: "",
          functionVersion: "",
          invokedFunctionArn: "",
          memoryLimitInMB: "",
          awsRequestId: "",
          logGroupName: "",
          logStreamName: "",
          getRemainingTimeInMillis() {
            return Number.MAX_SAFE_INTEGER
          },
          done() {},
          fail() {},
          succeed() {},
        }

        return {
          ...ctx,
          event,
          context,
        }
      },
    }),
  )
}
