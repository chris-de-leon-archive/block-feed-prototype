import { SQLWrapper, sql } from "drizzle-orm"
import { createClient } from "../../core"

export type FastCountInput = Readonly<{
  readonly schema: string
  readonly table: string
  readonly filters?: SQLWrapper
  readonly sample?: number | null | undefined
}>

/**
 * https://stackoverflow.com/a/7945274
 */
export const fastCount = async (
  db: ReturnType<typeof createClient>,
  args: FastCountInput
) => {
  return await db
    .execute<{ readonly estimate: number }>(
      sql`
        SELECT 100 * COUNT(*) AS estimate 
        FROM ${sql.identifier(args.schema)}.${sql.identifier(args.table)} 
        TABLESAMPLE SYSTEM (${args.sample ?? 1})
        WHERE ${args.filters ?? `1=1`}
      `
    )
    .then(({ rows }) => {
      const count = rows.at(0)?.estimate
      if (count == null) {
        throw new Error(
          `Could not count rows in "${args.schema}"."${args.table}"`
        )
      }
      return count
    })
}
