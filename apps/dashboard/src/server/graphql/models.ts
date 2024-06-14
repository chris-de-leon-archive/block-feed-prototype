import { builder } from "./builder"

export const gqlCount = builder.objectRef<{ count: number }>("Count")
builder.objectType(gqlCount, {
  name: "Count",
  fields: (t) => ({
    count: t.exposeInt("count"),
  }),
})

export const gqlUUID = builder.objectRef<{ id: string }>("UUID")
builder.objectType(gqlUUID, {
  name: "UUID",
  fields: (t) => ({
    id: t.exposeString("id"),
  }),
})
