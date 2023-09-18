import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { sql } from "drizzle-orm"

export const wipeDB = async (
  db: NodePgDatabase<typeof database.schema>,
  schema: string
) => {
  return await db.execute(
    sql.raw(`
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = '${schema}')
  LOOP
    EXECUTE 'TRUNCATE TABLE ${schema}.' || table_name || ' CASCADE';
  END LOOP;
END;
$$;
  `)
  )
}
