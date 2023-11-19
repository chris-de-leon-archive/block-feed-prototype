import { MySql2Database, drizzle } from "drizzle-orm/mysql2"
import { database } from "@api/shared/database"
import { getEnvVars } from "./get-env-vars"
import * as mysql from "mysql2/promise"

export const withConnection = async (
  cb: (
    ctx: Readonly<{
      db: MySql2Database<typeof database.schema>
      env: ReturnType<typeof getEnvVars>
    }>,
  ) => Promise<void> | void,
) => {
  const env = getEnvVars()

  const conn = await mysql.createConnection({
    uri: new URL(env.DRIZZLE_DB_NAME ?? "", env.DRIZZLE_DB_URL).href,
  })

  try {
    const db = drizzle(conn, {
      schema: database.schema,
      mode: env.DRIZZLE_DB_MODE,
      logger: true,
    })
    await cb({ db, env })
  } finally {
    await conn.end()
  }
}
