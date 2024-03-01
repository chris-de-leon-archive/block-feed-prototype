import { db } from "@block-feed/server/vendor/database"
import { trpc } from "@block-feed/server/trpc"
import { constants } from "../constants"
import { z } from "zod"

const zInput = z.object({
  id: z.string().uuid(),
})

const zOutput = z.object({
  count: z.number(),
})

export const name = "remove"

export const procedure = trpc.procedures.authedProcedure
  .meta({
    openapi: {
      method: "DELETE",
      path: `/${constants.NAMESPACE}/{id}`,
      protect: true,
    },
  })
  .input(zInput)
  .output(zOutput)
  .mutation(async (params) => {
    return await db.queries.webhooks
      .remove(params.ctx.inner.db.drizzle, {
        where: {
          id: params.input.id,
          customerId: params.ctx.user.sub,
        },
      })
      .then(([result]) => ({ count: result.affectedRows }))
  })
