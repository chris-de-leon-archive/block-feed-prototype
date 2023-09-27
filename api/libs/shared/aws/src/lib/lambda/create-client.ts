import { LambdaClient } from "@aws-sdk/client-lambda"
import { getEnvVars } from "../core"

export const createClient = () => {
  const env = getEnvVars()

  return new LambdaClient({
    endpoint: env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    region: env.AWS_REGION,
  })
}
