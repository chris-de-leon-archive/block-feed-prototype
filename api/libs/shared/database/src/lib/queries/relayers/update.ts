import { type InferSelectModel } from "drizzle-orm"
import { and, eq, sql } from "drizzle-orm"
import { createClient } from "../../core"
import { relayers } from "../../schema"

export type UpdateInput = Readonly<{
  data: Readonly<Partial<Pick<InferSelectModel<typeof relayers>, "name">>>
  where: Readonly<Pick<InferSelectModel<typeof relayers>, "id" | "userId">>
}>

export const update = async (
  db: ReturnType<typeof createClient>,
  args: UpdateInput,
) => {
  if (Object.values(args.data).filter((e) => e != null).length === 0) {
    return
  }

  const inputs = {
    placeholders: {
      id: sql.placeholder(relayers.id.name).getSQL(),
      name: sql.placeholder(relayers.name.name).getSQL(),
      userId: sql.placeholder(relayers.userId.name).getSQL(),
    },
    values: {
      [relayers.id.name]: args.where.id,
      [relayers.name.name]: args.data.name,
      [relayers.userId.name]: args.where.userId,
    },
  }

  // NOTE: if all updatable fields are undefined, an error will occur
  return await db.drizzle
    .update(relayers)
    .set({
      name: args.data.name != null ? inputs.placeholders.name : undefined,
    })
    .where(
      and(
        eq(relayers.id, inputs.placeholders.id),
        eq(relayers.userId, inputs.placeholders.userId),
      ),
    )
    .prepare()
    .execute(inputs.values)
}
