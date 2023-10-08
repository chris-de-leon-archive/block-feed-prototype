import { createClient, getPreparedStmtName } from "../../core"
import { type InferInsertModel } from "drizzle-orm"
import { blockchains } from "../../schema"
import { sql } from "drizzle-orm"

export type CreateInput = Readonly<
  Pick<InferInsertModel<typeof blockchains>, "id" | "name" | "url">
>

export const create = async (
  db: ReturnType<typeof createClient>,
  args: CreateInput
) => {
  const inputs = {
    placeholders: {
      name: sql.placeholder(blockchains.name.name),
      url: sql.placeholder(blockchains.url.name),
      id: sql.placeholder(blockchains.id.name),
    },
    values: {
      [blockchains.name.name]: args.name,
      [blockchains.url.name]: args.url,
      [blockchains.id.name]: args.id,
    },
  }

  const query = db
    .insert(blockchains)
    .values({
      id: inputs.placeholders.id,
      name: inputs.placeholders.name,
      url: inputs.placeholders.url,
    })
    .returning()

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
