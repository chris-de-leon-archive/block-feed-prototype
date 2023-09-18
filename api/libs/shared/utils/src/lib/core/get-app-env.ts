import { getRequiredEnvVar } from "./get-required-env-var"
import { AppEnv } from "./enums/app-env.enum"

const isAppEnv = (s: string): s is AppEnv => {
  return Object.values(AppEnv).includes(s as AppEnv)
}

export const getAppEnv = () => {
  const appEnv = getRequiredEnvVar("APP_ENV")

  if (!isAppEnv(appEnv)) {
    throw new Error(`"APP_ENV" must be one of ${Object.values(AppEnv)}`)
  }

  return appEnv
}
