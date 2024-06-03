import { MySql2Database } from "drizzle-orm/mysql2"
import * as schema from "@block-feed/drizzle"
import { execSync } from "node:child_process"
import { drizzle } from "drizzle-orm/mysql2"
import * as mysql from "mysql2/promise"

export const getRootDir = () => {
  const result = execSync("git rev-parse --show-toplevel").toString()
  return result.replace(new RegExp("\n", "g"), "")
}

export const withMySqlDatabaseConn = async <T>(
  url: string,
  cb: (
    ctx: Readonly<{
      conn: MySql2Database<typeof schema>
    }>,
  ) => Promise<T> | T,
) => {
  const conn = await mysql.createConnection(url)
  try {
    return await cb({
      conn: drizzle(conn, {
        schema: schema,
        mode: "default",
      }),
    })
  } finally {
    await conn.end()
  }
}
