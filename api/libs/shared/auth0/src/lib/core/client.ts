import * as auth0 from "auth0"
import { z } from "zod"

export const zAuthEnv = z.object({
  AUTH0_CLIENT_SECRET: z.string().min(1),
  AUTH0_CLIENT_ID: z.string().min(1),
  AUTH0_DOMAIN: z.string().min(1),
})

export const createClient = (env: z.infer<typeof zAuthEnv>) => {
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
