import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    BLOCK_DIVIDER_REDIS_URL: "BLOCK_DIVIDER_REDIS_URL",
    MAX_FUNCS_PER_CONSUMER: "MAX_FUNCS_PER_CONSUMER",
  } as const

  return {
    [ENV_KEYS.BLOCK_DIVIDER_REDIS_URL]: new URL(
      utils.getRequiredEnvVar(ENV_KEYS.BLOCK_DIVIDER_REDIS_URL)
    ),
    [ENV_KEYS.MAX_FUNCS_PER_CONSUMER]: parseInt(
      utils.getOptionalEnvVar(ENV_KEYS.MAX_FUNCS_PER_CONSUMER) ?? "500",
      10
    ),
  }
}
