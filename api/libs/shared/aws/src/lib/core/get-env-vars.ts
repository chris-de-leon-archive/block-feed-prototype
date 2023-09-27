import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    AWS_SECRET_ACCESS_KEY: "AWS_SECRET_ACCESS_KEY",
    AWS_ACCESS_KEY_ID: "AWS_ACCESS_KEY_ID",
    AWS_ENDPOINT: "AWS_ENDPOINT",
    AWS_REGION: "AWS_REGION",
  } as const

  return {
    [ENV_KEYS.AWS_SECRET_ACCESS_KEY]: utils.getRequiredEnvVar(
      ENV_KEYS.AWS_SECRET_ACCESS_KEY
    ),
    [ENV_KEYS.AWS_ACCESS_KEY_ID]: utils.getRequiredEnvVar(
      ENV_KEYS.AWS_ACCESS_KEY_ID
    ),
    [ENV_KEYS.AWS_ENDPOINT]: utils.getRequiredEnvVar(ENV_KEYS.AWS_ENDPOINT),
    [ENV_KEYS.AWS_REGION]: utils.getRequiredEnvVar(ENV_KEYS.AWS_REGION),
  }
}
