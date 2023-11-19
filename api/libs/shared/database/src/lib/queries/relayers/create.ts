import { type InferInsertModel } from "drizzle-orm"
import { createClient } from "../../core"
import { randomUUID } from "node:crypto"
import { relayers } from "../../schema"
import { sql } from "drizzle-orm"

export type CreateInput = Readonly<
  Pick<
    InferInsertModel<typeof relayers>,
    "name" | "userId" | "chain" | "transport" | "options"
  >
>

export const create = async (
  db: ReturnType<typeof createClient>,
  args: CreateInput,
) => {
  const id = randomUUID()

  const inputs = {
    placeholders: {
      id: sql.placeholder(relayers.id.name).getSQL(),
      name: sql.placeholder(relayers.name.name).getSQL(),
      userId: sql.placeholder(relayers.userId.name).getSQL(),
      chain: sql.placeholder(relayers.chain.name).getSQL(),
      transport: sql.placeholder(relayers.transport.name).getSQL(),
      options: sql.placeholder(relayers.options.name).getSQL(),
    },
    values: {
      [relayers.id.name]: id,
      [relayers.name.name]: args.name,
      [relayers.userId.name]: args.userId,
      [relayers.chain.name]: args.chain,
      [relayers.transport.name]: args.transport,
      [relayers.options.name]: JSON.stringify(args.options),
    },
  }

  const query = db.drizzle.insert(relayers).values({
    id: inputs.placeholders.id,
    name: inputs.placeholders.name,
    userId: inputs.placeholders.userId,
    chain: inputs.placeholders.chain,
    transport: inputs.placeholders.transport,
    options: inputs.placeholders.options,
  })

  return await query
    .prepare()
    .execute(inputs.values)
    .then((result) => {
      if (result[0].affectedRows === 0) {
        return {
          id: null,
          data: result,
        }
      }
      return {
        id,
        data: result,
      }
    })
}
