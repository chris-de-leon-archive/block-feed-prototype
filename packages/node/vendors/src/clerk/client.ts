import { clerkClient } from "@clerk/clerk-sdk-node"
import { z } from "zod"

export type ClerkVendor = ReturnType<typeof create>

export type ClerkUser = Readonly<{
  id: string
}>

export const zEnv = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_RAW_JWT_KEY: z.string().min(1),
})

export const create = (env: z.infer<typeof zEnv>) => {
  // https://stackoverflow.com/q/75440884
  const { JWT_KEY } = JSON.parse(env.CLERK_RAW_JWT_KEY)
  if (JWT_KEY == null) {
    throw new Error(
      `failed to parse JWT_KEY from env: ${JSON.stringify(env, null, 2)}`,
    )
  }

  return {
    client: clerkClient,
    env: {
      ...env,
      JWT_KEY,
    },
  }
}
