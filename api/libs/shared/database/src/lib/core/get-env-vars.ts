import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    DB_URL: "DB_URL",
  } as const

  return {
    [ENV_KEYS.DB_URL]: utils.getRequiredEnvVar(ENV_KEYS.DB_URL),
  }
}
