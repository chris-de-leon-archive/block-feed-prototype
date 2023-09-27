import { IAMClient } from "@aws-sdk/client-iam"
import { getEnvVars } from "../core"

export const createClient = () => {
  const env = getEnvVars()

  return new IAMClient({
    endpoint: env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    region: env.AWS_REGION,
  })
}
