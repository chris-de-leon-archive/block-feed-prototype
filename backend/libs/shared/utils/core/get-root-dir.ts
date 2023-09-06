import { execSync } from "node:child_process"
import * as path from "node:path"

export const getRootDir = (dir = "backend") => {
  const result = execSync("git rev-parse --show-toplevel").toString()
  return path.join(result.replace(new RegExp("\n", "g"), ""), dir)
}
