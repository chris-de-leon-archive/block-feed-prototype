import { exec } from "child_process"

export const wipeRedis = async () => {
  return await new Promise<
    Readonly<{
      stdout: string
      stderr: string
    }>
  >((res, rej) => {
    exec(`redis-cli -c "FLUSHALL"`, (err, stdout, stderr) => {
      if (err != null) {
        rej(err)
        return
      }
      res({
        stdout,
        stderr,
      })
    })
  })
}
