import { getEnvVars } from "./get-env-vars"
import * as auth0 from "auth0"

export const createClient = () => {
  const env = getEnvVars()

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
