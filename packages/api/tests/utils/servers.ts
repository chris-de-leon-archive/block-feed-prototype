import { builder } from "../../src/graphql/builder"
import { createYoga } from "graphql-yoga"
import * as http from "node:http"

export const createAsyncServer = async <T extends Record<string, any>>(
  params: Omit<Parameters<typeof createYoga<T>>[number], "schema">,
) => {
  const yoga = createYoga<T>({
    schema: builder.toSchema(),
    ...params,
  })

  const server = http.createServer(yoga)
  await new Promise((res) => {
    server.listen(0, "127.0.0.1", () => {
      res(undefined)
    })
  })

  const addr = server.address()
  if (addr == null || typeof addr === "string") {
    throw new Error(`invalid server address: ${addr}`)
  } else {
    console.log(`Server listening at: ${addr.address}:${addr.port}`)
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
