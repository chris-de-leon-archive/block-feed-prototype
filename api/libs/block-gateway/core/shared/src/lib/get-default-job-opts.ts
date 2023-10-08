import { JobsOptions } from "bullmq"

export const getDefaultJobOptions = (overrides?: JobsOptions): JobsOptions => {
  return {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 5,
    backoff: {
      type: "fixed",
      delay: 1000,
    },
    ...(overrides ?? {}),
  }
}
