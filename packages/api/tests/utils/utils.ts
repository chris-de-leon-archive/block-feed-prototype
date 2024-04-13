import { execSync } from "node:child_process"

export const getRootDir = () => {
  const result = execSync("git rev-parse --show-toplevel").toString()
  return result.replace(new RegExp("\n", "g"), "")
}

export const runPromisesInOrder = async (
  promises: Promise<unknown>[],
  onError: (err: unknown, i: number) => void | Promise<void>,
) => {
  for (let i = 0; i < promises.length; i++) {
    try {
      await promises[i]
    } catch (err) {
      await onError(err, i)
    }
  }
}
