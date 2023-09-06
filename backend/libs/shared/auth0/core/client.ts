import { getEnvVars } from "./get-env-vars"
import * as auth0 from "auth0"

export const createClient = () => {
  const credentials = getEnvVars()

  return {
    authentication: new auth0.AuthenticationClient(credentials),
    management: new auth0.ManagementClient(credentials),
  }
}
