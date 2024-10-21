import { gqlBadRequestError } from "./errors"
import { GraphQLAuthContext } from "./types"
import ZodPlugin from "@pothos/plugin-zod"
import SchemaBuilder from "@pothos/core"

export const builder = new SchemaBuilder<{
  DefaultFieldNullability: false
  Context: GraphQLAuthContext
}>({
  defaultFieldNullability: false,
  plugins: [ZodPlugin],
  zod: {
    validationError: (err) => {
      return gqlBadRequestError(err.errors.at(0)?.message ?? err.message)
    },
  },
})

builder.mutationType({})

builder.queryType({})
