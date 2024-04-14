import { execSync } from "node:child_process"

export const getRootDir = () => {
  const result = execSync("git rev-parse --show-toplevel").toString()
  return result.replace(new RegExp("\n", "g"), "")
}

export type CleanUpFunction = () => Promise<any> | any

export class TestCleaner {
  private readonly funcs = new Array<CleanUpFunction>()

  cleanUp = (param: CleanUpFunction | CleanUpFunction[]) => {
    if (Array.isArray(param)) {
      param.forEach((cb) => {
        this.funcs.push(cb)
      })
    } else {
      this.funcs.push(param)
    }
  }

  clean = async (onError: (err: unknown) => void | Promise<void>) => {
    // Clean up functions are run in reverse order like in Golang
    for (let i = this.funcs.length - 1; i >= 0; i--) {
      const func = this.funcs.at(i)
      if (func != null) {
        // If one or more of the cleanup functions fails, we do NOT want to
        // throw an error. Instead we log it and continue running the other
        // clean up functions so that all resources are gracefully released
        try {
          await func()
        } catch (err) {
          onError(err)
        }
      }
    }
  }
}
