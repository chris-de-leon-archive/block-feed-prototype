import { ClerkContext } from "../types"
import { Plugin } from "graphql-yoga"
import {
  RequireAuthContext,
  requireAuth,
} from "../middleware/require-auth.middleware"

export type ClerkJWTPluginParams = Omit<RequireAuthContext, "req">

export function withClerkJWT(
  params: ClerkJWTPluginParams,
): Plugin<ClerkContext> {
  return {
    async onContextBuilding(opts) {
      const user = await requireAuth({ ...params, req: opts.context.request })
      opts.extendContext({
        clerk: { user },
      })
    },
  }
}
