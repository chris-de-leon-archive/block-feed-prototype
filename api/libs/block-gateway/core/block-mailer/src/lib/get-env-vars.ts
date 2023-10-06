import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    BLOCK_MAILER_EMAIL_SOURCE: "BLOCK_MAILER_EMAIL_SOURCE",
    BLOCK_MAILER_REDIS_URL: "BLOCK_MAILER_REDIS_URL",
  } as const

  return {
    [ENV_KEYS.BLOCK_MAILER_REDIS_URL]: new URL(
      utils.getRequiredEnvVar(ENV_KEYS.BLOCK_MAILER_REDIS_URL)
    ),
    [ENV_KEYS.BLOCK_MAILER_EMAIL_SOURCE]: utils.getRequiredEnvVar(
      ENV_KEYS.BLOCK_MAILER_EMAIL_SOURCE
    ),
  }
}
