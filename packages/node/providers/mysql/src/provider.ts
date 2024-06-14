import { MySql2Database, drizzle } from "drizzle-orm/mysql2"
import * as schema from "@block-feed/node-db"
import * as mysql from "mysql2"
import { z } from "zod"

export const zEnv = z.object({
  DB_LOGGING: z.boolean().default(false),
  DB_URL: z.string().url(),
})

export class Provider {
  public readonly drizzle: MySql2Database<typeof schema>
  public readonly pool: mysql.Pool

  constructor(public readonly env: z.infer<typeof zEnv>) {
    this.pool = mysql.createPool({
      uri: env.DB_URL,
    })

    this.drizzle = drizzle<typeof schema>(this.pool, {
      logger: env.DB_LOGGING,
      mode: "default",
      schema,
    })
  }
}
