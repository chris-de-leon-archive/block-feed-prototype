import { NodePgQueryResultHKT } from "drizzle-orm/node-postgres"
import { ExtractTablesWithRelations } from "drizzle-orm"
import { PgTransaction } from "drizzle-orm/pg-core"
import { database } from "@api/shared/database"
import { sql } from "drizzle-orm"

export const createRoleIfNotExists = async (
  tx: PgTransaction<
    NodePgQueryResultHKT,
    typeof database.schema,
    ExtractTablesWithRelations<typeof database.schema>
  >,
  username: string,
  password: string
) => {
  const uname = sql.identifier(username)
  const pword = sql.raw(password)
  return await tx.execute(sql`
    DO $$
    BEGIN
      BEGIN
        CREATE ROLE ${uname} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD '${pword}';
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Role ${uname} already exists';
      END;
    END $$;
  `)
}
