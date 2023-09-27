import { createClient, getPreparedStmtName } from "../../core"
import { type InferInsertModel } from "drizzle-orm"
import { blockCursor } from "../../schema"
import { sql } from "drizzle-orm"

export type CreateInput = Readonly<
  Pick<InferInsertModel<typeof blockCursor>, "id" | "blockchain" | "networkURL">
>

export const create = async (
  db: ReturnType<typeof createClient>,
  args: CreateInput
) => {
  const inputs = {
    placeholders: {
      blockchain: sql.placeholder(blockCursor.blockchain.name),
      networkURL: sql.placeholder(blockCursor.networkURL.name),
      id: sql.placeholder(blockCursor.id.name),
    },
    values: {
      [blockCursor.blockchain.name]: args.blockchain,
      [blockCursor.networkURL.name]: args.networkURL,
      [blockCursor.id.name]: args.id,
    },
  }

  const query = db
    .insert(blockCursor)
    .values({
      id: inputs.placeholders.id,
      blockchain: inputs.placeholders.blockchain,
      networkURL: inputs.placeholders.networkURL,
    })
    .returning()

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
