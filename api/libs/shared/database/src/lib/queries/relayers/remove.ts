import { type InferSelectModel } from "drizzle-orm"
import { createClient } from "../../core"
import { relayers } from "../../schema"
import { eq, sql } from "drizzle-orm"

export type RemoveInput = Readonly<{
  where: Readonly<Pick<InferSelectModel<typeof relayers>, "id">>
}>

export const remove = async (
  db: ReturnType<typeof createClient>,
  args: RemoveInput,
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(relayers.id.name).getSQL(),
    },
    values: {
      [relayers.id.name]: args.where.id,
    },
  }

  return await db.drizzle
    .delete(relayers)
    .where(eq(relayers.id, inputs.placeholders.id))
    .prepare()
    .execute(inputs.values)
}
