import ValidationPlugin from "@pothos/plugin-validation"
import { gqlBadRequestError } from "./errors"
import { GraphQLAuthContext } from "./types"
import SchemaBuilder from "@pothos/core"

export const builder = new SchemaBuilder<{
  Context: GraphQLAuthContext
}>({
  plugins: [ValidationPlugin],
  validationOptions: {
    validationError: (err) => {
      return gqlBadRequestError(err.errors.at(0)?.message ?? err.message)
    },
  },
})

builder.mutationType({})

builder.queryType({})
