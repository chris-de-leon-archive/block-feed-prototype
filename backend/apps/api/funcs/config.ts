import { resolveEnvVars } from "./env"

export const sharedConfig = {
  environment: resolveEnvVars(),
  logRetentionInDays: 1,
} as const
