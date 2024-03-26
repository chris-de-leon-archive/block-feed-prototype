import { requireAuth } from "@block-feed/server/graphql/middleware/auth.middleware"
import { builder } from "@block-feed/server/graphql/builder"
import * as findMany from "./handlers/find-many"
import { gqlBlockchain } from "./models"

builder.queryField("blockchains", (t) =>
  t.field({
    type: [gqlBlockchain],
    args: {},
    validate: {
      schema: findMany.zInput,
    },
    resolve: async (_, args, ctx) => {
      const user = await requireAuth(ctx.yoga.request.headers, ctx)
      return await findMany.handler(args, {
        ...ctx,
        user,
      })
    },
  }),
)
