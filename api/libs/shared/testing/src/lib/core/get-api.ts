import { Configuration, ConfigurationParameters, DefaultApi } from "./openapi"

export const getApi = (params?: ConfigurationParameters) => {
  return new DefaultApi(new Configuration(params))
}
