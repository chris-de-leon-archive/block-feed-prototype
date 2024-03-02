import { trpc } from "@block-feed/server/trpc"
import { webhooks } from "./webhooks"

export const router = trpc.router({
  [webhooks.namespace]: webhooks.router,
})
