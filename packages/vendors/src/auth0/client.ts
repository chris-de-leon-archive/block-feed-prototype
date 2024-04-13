import * as auth0 from "auth0"
import { z } from "zod"

export type Auth0Vendor = ReturnType<typeof create>

export const zEnv = z.object({
  AUTH0_CLIENT_SECRET: z.string().min(1),
  AUTH0_CLIENT_ID: z.string().min(1),
  AUTH0_DOMAIN: z.string().min(1),
})

export const create = (env: z.infer<typeof zEnv>) => {
  const config = {
    clientId: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET,
    domain: env.AUTH0_DOMAIN,
  }

  return {
    management: new auth0.ManagementClient(config),
    userInfo: new auth0.UserInfoClient(config),
    oauth: new auth0.OAuth(config),
    env,
  }
}
