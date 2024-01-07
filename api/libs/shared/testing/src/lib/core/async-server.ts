import * as http from "node:http"

export const asyncServer = (server: http.Server) => {
  return {
    server,
    getInfo: () => {
      const addr = server.address()
      if (addr == null || typeof addr === "string") {
        throw new Error(`invalid server address: ${addr}`)
      }
      return {
        url: `http://${addr.address}:${addr.port}`,
        address: addr.address,
        port: addr.port,
      }
    },
    start: async () => {
      await new Promise((res) => {
        server.listen(0, "127.0.0.1", () => {
          res(undefined)
        })
      })
    },
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
