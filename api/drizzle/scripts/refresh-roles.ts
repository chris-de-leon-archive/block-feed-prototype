import { refreshBlockGatewayRole } from "../roles/block-gateway.role"
import { withConnection } from "drizzle/utils/with-connection"
import { refreshApiRole } from "../roles/api.role"
import { utils } from "@api/shared/utils"

withConnection(async ({ db, env }) => {
  await db.transaction(async (tx) => {
    await Promise.allSettled([
      refreshApiRole(tx, env.DB_API_ROLE_UNAME, env.DB_API_ROLE_PWORD),
      refreshBlockGatewayRole(
        tx,
        env.DB_BLOCK_GATEWAY_ROLE_UNAME,
        env.DB_BLOCK_GATEWAY_ROLE_PWORD
      ),
    ]).then(utils.throwIfError)
  })
})
