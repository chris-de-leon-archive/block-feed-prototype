export const constants = {
  webhooks: {
    limits: {
      MAX_UUIDS: {
        MIN: 0,
        MAX: 50,
      },
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
      URL_LEN: {
        MIN: 1,
        MAX: 2048,
      },
    },
  },
  pagination: {
    limits: {
      LIMIT: {
        MIN: 0,
        MAX: 25,
      },
      OFFSET: {
        MIN: 0,
      },
    },
  },
  reactquery: {
    MAX_QUERY_RETRIES: 3,
  },
} as const
