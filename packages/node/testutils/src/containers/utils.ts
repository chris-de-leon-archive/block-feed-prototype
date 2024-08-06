import * as net from "node:net"

export type VerboseOptions = {
  errors: boolean
  data: boolean
}

export const DOCKER_HOST = "host.docker.internal"

export const getRandomPort = async () => {
  return await new Promise<number>((res, rej) => {
    const srv = net.createServer()
    srv.listen(0, () => {
      const addr = srv.address()
      if (addr == null) {
        rej(new Error("could not obtain port"))
        return
      }
      if (typeof addr === "string") {
        rej(new Error(`could not infer port: ${addr}`))
        return
      }
      srv.close((err) => {
        if (err != null) {
          rej(err)
        } else {
          res(addr.port)
        }
      })
    })
  })
}
