import { LambdaClient } from "@aws-sdk/client-lambda"
import { getEnvVars } from "../core"

export const createClient = () => {
  const env = getEnvVars()

  return new LambdaClient({
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    region: env.region,
  })
}
