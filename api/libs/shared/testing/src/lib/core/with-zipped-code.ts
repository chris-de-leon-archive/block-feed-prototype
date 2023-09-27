import { spawn } from "node:child_process"
import * as path from "node:path"
import * as util from "node:util"
import { tmpdir } from "node:os"
import * as fs from "node:fs"

const withTmpDir = async <T>(cb: (dirpath: string) => Promise<T>) => {
  const dirpath = await util.promisify(fs.mkdtemp)(tmpdir())
  try {
    return await cb(dirpath)
  } finally {
    await util.promisify(fs.rm)(dirpath, { recursive: true })
  }
}

export const withZippedCode = async <T>(
  code: string,
  cb: (filepath: string) => Promise<T>
) => {
  return await withTmpDir(async (src) => {
    const jsFilePath = path.join(src, "handler.js")
    util.promisify(fs.writeFile)(jsFilePath, code)
    return await withTmpDir(async (dst) => {
      const zipFilePath = path.join(dst, "archive")
      await new Promise((res, rej) => {
        const proc = spawn("python", [
          path.join(__dirname, "py", "zip.py"),
          "--out",
          zipFilePath,
          "--src",
          src,
        ])

        proc.stderr.on("data", (data) => rej(new Error(data)))
        proc.stdout.on("data", (data) => console.log(String(data)))
        proc.on("close", res)
        proc.on("error", rej)
      })

      return await cb(`${zipFilePath}.zip`)
    })
  })
}
