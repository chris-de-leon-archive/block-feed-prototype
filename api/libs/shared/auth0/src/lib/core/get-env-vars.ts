import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    AUTH0_CLIENT_SECRET: "AUTH0_CLIENT_SECRET",
    AUTH0_CLIENT_ID: "AUTH0_CLIENT_ID",
    AUTH0_DOMAIN: "AUTH0_DOMAIN",
  } as const

  return {
    [ENV_KEYS.AUTH0_CLIENT_SECRET]: utils.getRequiredEnvVar(
      ENV_KEYS.AUTH0_CLIENT_SECRET
    ),
    [ENV_KEYS.AUTH0_CLIENT_ID]: utils.getRequiredEnvVar(
      ENV_KEYS.AUTH0_CLIENT_ID
    ),
    [ENV_KEYS.AUTH0_DOMAIN]: utils.getRequiredEnvVar(ENV_KEYS.AUTH0_DOMAIN),
  }
}
