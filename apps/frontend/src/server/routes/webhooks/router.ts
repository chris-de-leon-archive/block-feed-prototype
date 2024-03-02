import * as findMany from "./routes/find-many"
import * as activate from "./routes/activate"
import * as findOne from "./routes/find-one"
import * as remove from "./routes/remove"
import * as create from "./routes/create"
import * as update from "./routes/update"
import { trpc } from "@block-feed/server/trpc"

export const router = trpc.router({
  [findMany.name]: findMany.procedure,
  [activate.name]: activate.procedure,
  [findOne.name]: findOne.procedure,
  [create.name]: create.procedure,
  [remove.name]: remove.procedure,
  [update.name]: update.procedure,
})
