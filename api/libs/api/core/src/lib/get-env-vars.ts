import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    API_DB_URL: "API_DB_URL",
  } as const

  return {
    [ENV_KEYS.API_DB_URL]: utils.getRequiredEnvVar(ENV_KEYS.API_DB_URL),
  }
}
