import { Configuration, DefaultApi } from "./openapi"
import { getEnvVars } from "./get-env-vars"

export const getApi = () => {
  const { url } = getEnvVars()

  return new DefaultApi(
    new Configuration({
      basePath: url,
    })
  )
}
