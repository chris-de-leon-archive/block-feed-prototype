import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  return {
    url: utils.getRequiredEnvVar("DB_URL"),
  }
}
