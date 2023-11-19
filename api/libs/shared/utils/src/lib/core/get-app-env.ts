import { AppEnv } from "./enums/app-env.enum"
import { z } from "zod"

export const getAppEnv = () =>
  z
    .object({
      APP_ENV: z.nativeEnum(AppEnv),
    })
    .parse(process.env).APP_ENV
