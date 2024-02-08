import { execSync } from "node:child_process"

export const getRootDir = () => {
  const result = execSync("git rev-parse --show-toplevel").toString()
  return result.replace(new RegExp("\n", "g"), "")
}
