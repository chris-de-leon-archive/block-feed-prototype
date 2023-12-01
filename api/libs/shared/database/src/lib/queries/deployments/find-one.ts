import { type InferSelectModel } from "drizzle-orm"
import { createClient } from "../../core"
import { deployments } from "../../schema"
import { sql } from "drizzle-orm"

export type FindOneInput = Readonly<{
  where: Readonly<Pick<InferSelectModel<typeof deployments>, "id" | "userId">>
}>

export const findOne = async (
  db: ReturnType<typeof createClient>,
  args: FindOneInput,
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(deployments.id.name).getSQL(),
      userId: sql.placeholder(deployments.userId.name).getSQL(),
    },
    values: {
      [deployments.id.name]: args.where.id,
      [deployments.userId.name]: args.where.userId,
    },
  }

  return await db.drizzle.query.deployments
    .findFirst({
      where(fields, operators) {
        return operators.and(
          operators.eq(fields.id, inputs.placeholders.id),
          operators.eq(fields.userId, inputs.placeholders.userId),
        )
      },
      with: {
        relayers: true,
      },
    })
    .prepare()
    .execute(inputs.values)
}
