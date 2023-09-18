import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  return {
    secretAccessKey: utils.getRequiredEnvVar("AWS_SECRET_ACCESS_KEY"),
    accessKeyId: utils.getRequiredEnvVar("AWS_ACCESS_KEY_ID"),
    region: utils.getRequiredEnvVar("AWS_REGION"),
  }
}
