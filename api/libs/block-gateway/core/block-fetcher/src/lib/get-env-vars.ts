import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    BLOCK_FETCHER_BLOCK_DELAY_MS: "BLOCK_FETCHER_BLOCK_DELAY_MS",
    BLOCK_FETCHER_REDIS_URL: "BLOCK_FETCHER_REDIS_URL",
    BLOCK_FETCHER_MAX_JOBS: "BLOCK_FETCHER_MAX_JOBS",
  } as const

  return {
    [ENV_KEYS.BLOCK_FETCHER_BLOCK_DELAY_MS]: parseInt(
      utils.getOptionalEnvVar(ENV_KEYS.BLOCK_FETCHER_BLOCK_DELAY_MS) ?? "1000",
      10
    ),
    [ENV_KEYS.BLOCK_FETCHER_REDIS_URL]: new URL(
      utils.getRequiredEnvVar(ENV_KEYS.BLOCK_FETCHER_REDIS_URL)
    ),
    [ENV_KEYS.BLOCK_FETCHER_MAX_JOBS]: parseInt(
      utils.getOptionalEnvVar(ENV_KEYS.BLOCK_FETCHER_MAX_JOBS) ?? "100",
      10
    ),
  }
}
