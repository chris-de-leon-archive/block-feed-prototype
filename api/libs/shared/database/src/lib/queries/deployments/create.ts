import { type InferInsertModel } from "drizzle-orm"
import { deployments } from "../../schema"
import { createClient } from "../../core"
import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"

export type CreateInput = Readonly<{
  data: Readonly<Omit<InferInsertModel<typeof deployments>, "id" | "createdAt">>
}>

export const create = async (
  db: ReturnType<typeof createClient>,
  args: CreateInput,
) => {
  const id = randomUUID()

  const inputs = {
    placeholders: {
      id: sql.placeholder(deployments.id.name).getSQL(),
      name: sql.placeholder(deployments.name.name).getSQL(),
      namespace: sql.placeholder(deployments.namespace.name).getSQL(),
      userId: sql.placeholder(deployments.userId.name).getSQL(),
    },
    values: {
      [deployments.id.name]: id,
      [deployments.name.name]: args.data.name,
      [deployments.namespace.name]: args.data.namespace,
      [deployments.userId.name]: args.data.userId,
    },
  }

  const query = db.drizzle.insert(deployments).values({
    id: inputs.placeholders.id,
    name: inputs.placeholders.name,
    namespace: inputs.placeholders.namespace,
    userId: inputs.placeholders.userId,
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
