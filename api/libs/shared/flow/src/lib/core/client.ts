import { getEnvVars } from "./get-env-vars"
import * as fcl from "@onflow/fcl"

export const createClient = () => {
  const env = getEnvVars()

  fcl.config({
    "accessNode.api": env.ONFLOW_ACCESS_API_URL,
  })

  return {
    fcl,
    env,
  }
}
