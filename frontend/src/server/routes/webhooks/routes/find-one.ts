import { db } from "@block-feed/server/vendor/database"
import { createSelectSchema } from "drizzle-zod"
import { trpc } from "@block-feed/server/trpc"
import { constants } from "../constants"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

const zInput = z.object({
  id: z.string().uuid(),
})

const zOutput = createSelectSchema(db.schema.webhook)

export const name = "findOne"

export const procedure = trpc.procedures.authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: `/${constants.NAMESPACE}/{id}`,
      protect: true,
    },
  })
  .input(zInput)
  .output(zOutput)
  .query(async (params) => {
    const result = await db.queries.webhooks.findOne(
      params.ctx.inner.db.drizzle,
      {
        where: {
          id: params.input.id,
          customerId: params.ctx.user.sub,
        },
      },
    )

    if (result == null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `record with id "${params.input.id}" does not exist`,
      })
    }

    return result
  })
