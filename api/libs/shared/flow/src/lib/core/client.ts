import { getEnvVars } from "./get-env-vars"
import * as fcl from "@onflow/fcl"

export const createClient = () => {
  const env = getEnvVars()

  fcl.config({
    "accessNode.api": env.url,
  })

  return {
    fcl,
    env,
  }
}
