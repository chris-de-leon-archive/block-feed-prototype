import { AppEnv } from "./enums/app-env.enum"

const isAppEnv = (s: string): s is AppEnv => {
  return Object.values(AppEnv).includes(s as AppEnv)
}

export const getAppEnv = () => {
  const appEnv = process.env["APP_ENV"]
  if (appEnv == null) {
    throw new Error('environment variable "APP_ENV" is not defined')
  }

  if (!isAppEnv(appEnv)) {
    throw new Error(`"APP_ENV" must be one of ${Object.values(AppEnv)}`)
  }

  return appEnv
}
