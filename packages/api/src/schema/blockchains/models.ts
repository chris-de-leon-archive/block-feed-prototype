import { builder } from "../../graphql/builder"
import { InferSelectModel } from "drizzle-orm"
import * as schema from "@block-feed/drizzle"

export const gqlBlockchain =
  builder.objectRef<InferSelectModel<typeof schema.blockchain>>("Blockchain")

builder.objectType(gqlBlockchain, {
  fields: (t) => {
    return {
      id: t.exposeString("id"),
      url: t.exposeString("url"),
    }
  },
})
