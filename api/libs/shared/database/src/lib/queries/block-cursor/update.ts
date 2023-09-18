import { createClient, getPreparedStmtName } from "../../core"
import { eq, type InferInsertModel } from "drizzle-orm"
import { database } from "@api/shared/database"
import { blockCursor } from "../../schema"
import { sql } from "drizzle-orm"

export type UpdateInput = Readonly<
  Pick<InferInsertModel<typeof blockCursor>, "id" | "height">
>

export const update = async (
  db: ReturnType<typeof createClient>,
  args: UpdateInput
) => {
  const inputs = {
    placeholders: {
      updatedAt: sql.placeholder(blockCursor.updatedAt.name).getSQL(),
      height: sql.placeholder(blockCursor.height.name).getSQL(),
      id: sql.placeholder(blockCursor.id.name),
    },
    values: {
      [blockCursor.updatedAt.name]: new Date(),
      [blockCursor.height.name]: args.height,
      [blockCursor.id.name]: args.id,
    },
  }

  const query = db
    .update(blockCursor)
    .set({
      height: inputs.placeholders.height,
      updatedAt: inputs.placeholders.updatedAt,
    })
    .where(eq(database.schema.blockCursor.id, inputs.placeholders.id))

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
