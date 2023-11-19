import { withConnection } from "drizzle/utils/with-connection"
import { refreshApiRole } from "../roles/api.role"
import { utils } from "@api/shared/utils"

withConnection(async ({ db, env }) => {
  await db.transaction(async (tx) => {
    await Promise.allSettled([
      refreshApiRole(
        tx,
        env.DRIZZLE_DB_API_USER_UNAME,
        env.DRIZZLE_DB_API_USER_PWORD,
      ),
    ]).then(utils.throwIfError)
  })
})
