import { createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { and, eq, sql } from "drizzle-orm"
import { funcs } from "../../schema"

export type UpdateInput = Readonly<
  Pick<InferSelectModel<typeof funcs>, "id" | "name" | "userId">
>

export const update = async (
  db: ReturnType<typeof createClient>,
  args: UpdateInput
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(funcs.id.name).getSQL(),
      name: sql.placeholder(funcs.name.name).getSQL(),
      userId: sql.placeholder(funcs.userId.name).getSQL(),
    },
    values: {
      [funcs.id.name]: args.id,
      [funcs.name.name]: args.name,
      [funcs.userId.name]: args.userId,
    },
  }

  const query = db
    .update(funcs)
    .set({
      name: inputs.placeholders.name,
    })
    .where(
      and(
        eq(funcs.id, inputs.placeholders.id),
        eq(funcs.userId, inputs.placeholders.userId)
      )
    )

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
