import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  return {
    url: utils.getRequiredEnvVar("TEST_LOCALSTACK_URL"),
  }
}
