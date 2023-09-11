import { getRootDir } from "./get-root-dir"
import { getEnvVars } from "./get-env-vars"
import { getAppEnv } from "./get-app-env"
import * as path from "path"

export const resolveEnvVars = (filenames: string[]) => {
  const envRoot = path.join(getRootDir(), "env", getAppEnv())
  const envPths = filenames.map((n) => path.join(envRoot, n))
  return getEnvVars(envPths)
}
