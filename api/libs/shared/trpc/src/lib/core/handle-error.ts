import { TRPCError } from "@trpc/server"
import { DatabaseError } from "pg"

export const handleError = (err: unknown) => {
  if (err instanceof DatabaseError) {
    if (err.code === "23505") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: err.detail,
        cause: err,
      })
    } else {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err.detail,
        cause: err,
      })
    }
  }
  throw err
}
