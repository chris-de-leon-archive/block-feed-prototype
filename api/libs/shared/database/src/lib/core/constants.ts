export const CONSTANTS = {
  DATABASES: {
    BLOCK_FEED: "block_feed",
  },
  SCHEMA: {
    RELAYERS: {
      MAX_NAME_LEN: 255,
      MAX_ID_LEN: 36,
    },
    USERS: {
      MAX_ID_LEN: 255,
    },
  },
  OFFSET: "offset",
  LIMIT: "limit",
} as const
