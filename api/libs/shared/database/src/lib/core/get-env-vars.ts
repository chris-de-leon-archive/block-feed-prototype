import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const ENV_KEYS = {
    DB_BLOCK_GATEWAY_ROLE_UNAME: "DB_BLOCK_GATEWAY_ROLE_UNAME",
    DB_BLOCK_GATEWAY_ROLE_PWORD: "DB_BLOCK_GATEWAY_ROLE_PWORD",
    DB_API_ROLE_UNAME: "DB_API_ROLE_UNAME",
    DB_API_ROLE_PWORD: "DB_API_ROLE_PWORD",
    DB_URL: "DB_URL",
  } as const

  return {
    [ENV_KEYS.DB_BLOCK_GATEWAY_ROLE_UNAME]: utils.getRequiredEnvVar(
      ENV_KEYS.DB_BLOCK_GATEWAY_ROLE_UNAME
    ),
    [ENV_KEYS.DB_BLOCK_GATEWAY_ROLE_PWORD]: utils.getRequiredEnvVar(
      ENV_KEYS.DB_BLOCK_GATEWAY_ROLE_PWORD
    ),
    [ENV_KEYS.DB_API_ROLE_UNAME]: utils.getRequiredEnvVar(
      ENV_KEYS.DB_API_ROLE_UNAME
    ),
    [ENV_KEYS.DB_API_ROLE_PWORD]: utils.getRequiredEnvVar(
      ENV_KEYS.DB_API_ROLE_PWORD
    ),
    [ENV_KEYS.DB_URL]: utils.getRequiredEnvVar(ENV_KEYS.DB_URL),
  }
}
