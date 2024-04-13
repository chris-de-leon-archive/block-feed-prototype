import { Auth0Context } from "../types"
import { Plugin } from "graphql-yoga"
import {
  RequireAuthContext,
  requireAuth,
} from "../middleware/require-auth.middleware"

export type Auth0JWTPluginParams = Omit<RequireAuthContext, "req">

export function withAuth0JWT(
  params: Auth0JWTPluginParams,
): Plugin<Auth0Context> {
  return {
    async onContextBuilding(opts) {
      const user = await requireAuth({ ...params, req: opts.context.request })
      opts.extendContext({
        auth0: { user },
      })
    },
  }
}
