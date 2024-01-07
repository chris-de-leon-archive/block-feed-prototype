import { createOpenApiHttpHandler } from "trpc-openapi"
import { APIGatewayEvent, Context } from "aws-lambda"
import { RelayersAPI } from "@api/api/relayers/api"
import { randomUUID } from "node:crypto"
import { trpc } from "@api/shared/trpc"
import * as http from "node:http"

export type RelayersContext = RelayersAPI.Context &
  RelayersAPI.CreateContext &
  RelayersAPI.DeployContext

// TODO: is there a way to make this more type safe?
export const t = trpc.createTRPC<any>()

export const router = t.router({
  [RelayersAPI.NAMESPACE]: t.router({
    [RelayersAPI.OPERATIONS.FIND_MANY.NAME]: RelayersAPI.findMany(t),
    [RelayersAPI.OPERATIONS.FIND_ONE.NAME]: RelayersAPI.findOne(t),
    [RelayersAPI.OPERATIONS.CREATE.NAME]: RelayersAPI.create(t),
    [RelayersAPI.OPERATIONS.UPDATE.NAME]: RelayersAPI.update(t),
    [RelayersAPI.OPERATIONS.REMOVE.NAME]: RelayersAPI.remove(t),
    [RelayersAPI.OPERATIONS.DEPLOY.NAME]: RelayersAPI.deploy(t),
  }),
})

export const createWebhookServer = (
  cbs: Readonly<
    Partial<{
      onReq: (req: http.IncomingMessage, res: http.ServerResponse) => void
      onErr: (req: http.IncomingMessage, res: http.ServerResponse) => void
    }>
  >,
) =>
  http.createServer((req, res) => {
    if (req.url === "/webhook" && req.method === "POST") {
      cbs.onReq != null && cbs.onReq(req, res)
      res.writeHead(200, { "Content-Type": "text/plain" })
      res.end("OK")
    } else {
      cbs.onErr != null && cbs.onErr(req, res)
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("Not Found")
    }
  })

// TODO: make this more general and move to testutils package
export const createAppServer = (
  ctx: RelayersContext,
  options: { verbose: boolean },
) =>
  http.createServer(
    createOpenApiHttpHandler({
      router,
      onError: (opts) => {
        options.verbose && console.error(opts)
      },
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

        // https://www.serverless.com/framework/docs/providers/aws/events/apigateway#example-lambda-proxy-event-default
        const event: APIGatewayEvent = {
          // TODO: is there a way to get the request body?
          body: "",
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
