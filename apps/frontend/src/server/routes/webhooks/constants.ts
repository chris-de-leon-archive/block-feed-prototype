export const constants = {
  NAMESPACE: "webhooks",
  LIMITS: {
    MAX_BLOCKS: {
      MIN: 1,
      MAX: 10,
    },
    MAX_RETRIES: {
      MIN: 0,
      MAX: 10,
    },
    TIMEOUT_MS: {
      MIN: 0,
      MAX: 10000,
    },
    BLOCKCHAIN_ID: {
      MIN: 0,
      MAX: 1024,
    },
    LIMIT: {
      MIN: 0,
      MAX: 25,
    },
    OFFSET: {
      MIN: 0,
    },
  },
} as const
