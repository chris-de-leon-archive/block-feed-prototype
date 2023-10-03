import { refreshBlockGatewayRole } from "../roles/block-gateway.role"
import { withConnection } from "drizzle/utils/with-connection"
import { refreshApiRole } from "../roles/api.role"

withConnection(async ({ db, env }) => {
  await db.transaction(async (tx) => {
    await Promise.allSettled([
      refreshApiRole(tx, env.DB_API_ROLE_UNAME, env.DB_API_ROLE_PWORD),
      refreshBlockGatewayRole(
        tx,
        env.DB_BLOCK_GATEWAY_ROLE_UNAME,
        env.DB_BLOCK_GATEWAY_ROLE_PWORD
      ),
    ]).then((results) => {
      results.forEach((r) => {
        if (r.status === "rejected") {
          throw new Error(r.reason)
        }
      })
    })
  })
})
