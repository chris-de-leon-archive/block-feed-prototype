import { TypedDocumentNode } from "@graphql-typed-document-node/core"
import { YogaServerInstance, createYoga } from "graphql-yoga"
import { ExecutionResult, print } from "graphql"
import * as http from "node:http"

export class TestServer<
  T extends Record<string, any>,
  U extends Record<string, any>,
> {
  public readonly url: string
  public readonly address: string
  public readonly port: number

  private constructor(
    private readonly yogaServer: YogaServerInstance<T, U>,
    private readonly httpServer: http.Server<
      typeof http.IncomingMessage,
      typeof http.ServerResponse
    >,
  ) {
    const addr = httpServer.address()
    if (addr == null || typeof addr === "string") {
      throw new Error(`invalid server address: ${addr}`)
    } else {
      console.log(`Server listening at: ${addr.address}:${addr.port}`)
    }

    this.url = `http://${addr.address}:${addr.port}`
    this.address = addr.address
    this.port = addr.port
  }

  static build = async <
    T extends Record<string, any>,
    U extends Record<string, any>,
  >(
    params: Parameters<typeof createYoga<T, U>>[number],
  ) => {
    const yogaServer = createYoga<T>(params)

    const httpServer = http.createServer(yogaServer)
    await new Promise((res) => {
      httpServer.listen(0, "127.0.0.1", () => {
        res(undefined)
      })
    })

    return new TestServer(yogaServer, httpServer)
  }

  makeRequest = async <TResult, TVariables extends Record<string, unknown>>(
    document: TypedDocumentNode<TResult, TVariables>,
    variables: TVariables,
    headers: HeadersInit | undefined,
  ): Promise<{ status: number; payload: ExecutionResult<TResult> }> => {
    const result = await this.yogaServer.fetch(`http://${this.url}/graphql`, {
      method: "POST",
      headers: {
        ...(headers ?? {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: print(document),
        variables,
      }),
    })
    return {
      status: result.status,
      payload: await result.json(),
    }
  }

  close = async () => {
    await new Promise((res, rej) => {
      this.httpServer.close((err) => {
        if (err != null) {
          rej(err)
        } else {
          res(undefined)
        }
      })
    })
  }
}
