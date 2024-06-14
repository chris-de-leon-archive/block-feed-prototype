import { clerkClient } from "@clerk/clerk-sdk-node"
import { z } from "zod"

export type User = Readonly<{
  id: string
}>

export const zEnv = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_RAW_JWT_KEY: z.string().min(1),
})

export class Provider {
  public readonly client: typeof clerkClient
  public readonly env: z.infer<typeof zEnv> & Readonly<{ JWT_KEY: string }>

  constructor(env: z.infer<typeof zEnv>) {
    // https://stackoverflow.com/q/75440884
    const { JWT_KEY } = JSON.parse(env.CLERK_RAW_JWT_KEY)
    if (JWT_KEY == null) {
      throw new Error(
        `failed to parse JWT_KEY from env: ${JSON.stringify(env, null, 2)}`,
      )
    }

    this.client = clerkClient
    this.env = {
      ...env,
      JWT_KEY,
    }
  }
}
