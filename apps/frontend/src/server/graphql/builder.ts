import ValidationPlugin from "@pothos/plugin-validation"
import { gqlBadRequestError } from "./errors"
import SchemaBuilder from "@pothos/core"
import { Context } from "./types"

export const builder = new SchemaBuilder<{
  Context: Context
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
