import { type InferSelectModel } from "drizzle-orm"
import { createClient } from "../../core"
import { relayers } from "../../schema"
import { sql } from "drizzle-orm"

export type FindOneInput = Readonly<
  Pick<InferSelectModel<typeof relayers>, "id" | "userId">
>

export const findOne = async (
  db: ReturnType<typeof createClient>,
  args: FindOneInput,
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(relayers.id.name).getSQL(),
      userId: sql.placeholder(relayers.userId.name).getSQL(),
    },
    values: {
      [relayers.id.name]: args.id,
      [relayers.userId.name]: args.userId,
    },
  }

  return await db.drizzle.query.relayers
    .findFirst({
      where(fields, operators) {
        return operators.and(
          operators.eq(fields.id, inputs.placeholders.id),
          operators.eq(fields.userId, inputs.placeholders.userId),
        )
      },
    })
    .prepare()
    .execute(inputs.values)
}
