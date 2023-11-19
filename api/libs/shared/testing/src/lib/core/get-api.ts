import { Configuration, DefaultApi } from "./openapi"
import { getEnvVars } from "./get-env-vars"

export const getApi = () => {
  const env = getEnvVars()

  return new DefaultApi(
    new Configuration({
      basePath: env.TEST_API_URL,
    }),
  )
}
