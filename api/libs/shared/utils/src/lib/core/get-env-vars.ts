import * as dotenv from "dotenv"
import * as fs from "node:fs"

export const getEnvVars = (paths: string[]) => {
  return paths
    .filter((path) => path.endsWith(".env"))
    .filter((path) => fs.existsSync(path))
    .reduce((prev, curr) => {
      return {
        ...prev,
        ...dotenv.parse(fs.readFileSync(curr)),
      }
    }, {})
}
