import { JobsOptions } from "bullmq"

export const getDefaultJobOptions = (): JobsOptions => {
  return {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 5,
  }
}
