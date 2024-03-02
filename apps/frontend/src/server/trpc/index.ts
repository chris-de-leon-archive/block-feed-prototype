import * as procedures from "./procedures"
import { router } from "./trpc"

export * from "./context"

export const trpc = {
  procedures,
  router,
}
