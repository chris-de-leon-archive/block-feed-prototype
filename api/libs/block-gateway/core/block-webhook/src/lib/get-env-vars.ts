import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    BLOCK_WEBHOOK_REDIS_URL: "BLOCK_WEBHOOK_REDIS_URL",
  } as const

  return {
    [ENV_KEYS.BLOCK_WEBHOOK_REDIS_URL]: new URL(
      utils.getRequiredEnvVar(ENV_KEYS.BLOCK_WEBHOOK_REDIS_URL)
    ),
  }
}
