import { getEnvVars } from "./get-env-vars"
import * as auth0 from "auth0"

export const createClient = () => {
  const env = getEnvVars()

  return {
    management: new auth0.ManagementClient(env),
    userInfo: new auth0.UserInfoClient(env),
    oauth: new auth0.OAuth(env),
    env,
  }
}
