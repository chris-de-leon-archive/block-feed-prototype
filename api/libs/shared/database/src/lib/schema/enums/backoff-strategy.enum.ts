import { pgEnum } from "drizzle-orm/pg-core"

export enum BackoffStrategy {
  EXPONENTIAL = "exponential",
  FIXED = "fixed",
}

// TODO: https://github.com/drizzle-team/drizzle-orm/issues/669
export const backoffStrategyEnum = pgEnum("backoff_strategy_enum", [
  BackoffStrategy.EXPONENTIAL,
  ...Object.values(BackoffStrategy),
])
