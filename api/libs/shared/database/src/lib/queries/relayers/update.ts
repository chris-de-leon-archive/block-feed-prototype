import { type InferSelectModel } from "drizzle-orm"
import { and, eq, sql } from "drizzle-orm"
import { createClient } from "../../core"
import { relayers } from "../../schema"

export type UpdateInput = Readonly<
  Partial<Pick<InferSelectModel<typeof relayers>, "id" | "name" | "userId">>
>

export const update = async (
  db: ReturnType<typeof createClient>,
  args: UpdateInput,
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(relayers.id.name).getSQL(),
      name: sql.placeholder(relayers.name.name).getSQL(),
      userId: sql.placeholder(relayers.userId.name).getSQL(),
    },
    values: {
      [relayers.id.name]: args.id,
      [relayers.name.name]: args.name,
      [relayers.userId.name]: args.userId,
    },
  }

  // TODO: if all updatable fields are undefined, what happens?
  return await db.drizzle
    .update(relayers)
    .set({
      name: inputs.placeholders.name,
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
