import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  return {
    clientSecret: utils.getRequiredEnvVar("AUTH0_CLIENT_SECRET"),
    clientId: utils.getRequiredEnvVar("AUTH0_CLIENT_ID"),
    domain: utils.getRequiredEnvVar("AUTH0_DOMAIN"),
  }
}
