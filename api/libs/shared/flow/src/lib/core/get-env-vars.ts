import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  return {
    url: utils.getRequiredEnvVar("ONFLOW_ACCESS_API_URL"),
  }
}
