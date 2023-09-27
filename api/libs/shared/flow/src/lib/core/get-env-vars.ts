import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    ONFLOW_ACCESS_API_URL: "ONFLOW_ACCESS_API_URL",
  } as const

  return {
    [ENV_KEYS.ONFLOW_ACCESS_API_URL]: utils.getRequiredEnvVar(
      ENV_KEYS.ONFLOW_ACCESS_API_URL
    ),
  }
}
