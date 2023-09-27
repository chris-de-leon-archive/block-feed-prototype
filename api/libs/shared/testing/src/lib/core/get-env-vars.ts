import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    TEST_LOCALSTACK_URL: "TEST_LOCALSTACK_URL",
  } as const

  return {
    [ENV_KEYS.TEST_LOCALSTACK_URL]: utils.getRequiredEnvVar(
      ENV_KEYS.TEST_LOCALSTACK_URL
    ),
  }
}
