import { builder } from "./builder"

export const gqlCursorInput = builder.inputType("CursorInput", {
  fields: (t) => ({
    id: t.string({ required: true }),
    reverse: t.boolean({ required: true }),
  }),
})

export const gqlCursorPaginationInput = builder.inputType(
  "CursorPaginationInput",
  {
    fields: (t) => ({
      limit: t.int({ required: true }),
      cursor: t.field({
        type: gqlCursorInput,
        required: false,
      }),
    }),
  },
)

export const gqlStringLikeFilterInput = builder.inputType(
  "StringLikeFilterInput",
  {
    fields: (t) => ({
      like: t.string({ required: false }),
    }),
  },
)

export const gqlStringEqFilterInput = builder.inputType("StringEqFilterInput", {
  fields: (t) => ({
    eq: t.string({ required: false }),
  }),
})

export const gqlBoolEqFilterInput = builder.inputType("BoolEqFilterInput", {
  fields: (t) => ({
    eq: t.boolean({ required: false }),
  }),
})
