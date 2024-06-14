import { Cluster, Redis } from "ioredis"
import { scripts } from "./scripts"
import { z } from "zod"

export const zEnv = z.object({
  REDIS_CLUSTER_URL: z.string().url(),
})

export class Provider {
  public readonly client: Cluster

  constructor(public readonly env: z.infer<typeof zEnv>) {
    this.client = new Redis.Cluster([env.REDIS_CLUSTER_URL], {
      scripts,
    })
  }
}
