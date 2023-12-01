export const CONSTANTS = {
  DATABASES: {
    BLOCK_FEED: "block_feed",
  },
  SCHEMA: {
    DEPLOYMENTS: {
      MAX_NAMESPACE_LEN: 253,
      MAX_NAME_LEN: 253,
    },
    RELAYERS: {
      MAX_NAME_LEN: 255,
    },
    USERS: {
      MAX_ID_LEN: 255,
    },
    SHARED: {
      UUID_LEN: 36,
    },
  },
  OFFSET: "offset",
  LIMIT: "limit",
} as const
