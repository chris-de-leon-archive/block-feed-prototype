import { type InferSelectModel } from "drizzle-orm"
import { createClient } from "../../core"
import { relayers } from "../../schema"
import { sql } from "drizzle-orm"

export type FindManyByDeploymentIdInput = Readonly<{
  where: Readonly<
    Pick<InferSelectModel<typeof relayers>, "userId" | "deploymentId">
  >
}>

export const findManyByDeploymentId = async (
  db: ReturnType<typeof createClient>,
  args: FindManyByDeploymentIdInput,
) => {
  const inputs = {
    placeholders: {
      userId: sql.placeholder(relayers.userId.name).getSQL(),
      deploymentId: sql.placeholder(relayers.deploymentId.name).getSQL(),
    },
    values: {
      [relayers.userId.name]: args.where.userId,
      [relayers.deploymentId.name]: args.where.deploymentId,
    },
  }

  return await db.drizzle.query.relayers
    .findMany({
      where(fields, operators) {
        return operators.and(
          operators.eq(fields.userId, inputs.placeholders.userId),
          operators.eq(fields.deploymentId, inputs.placeholders.deploymentId),
        )
      },
      orderBy(fields, operators) {
        return [operators.desc(fields.createdAt), operators.desc(fields.id)]
      },
    })
    .prepare()
    .execute(inputs.values)
}
