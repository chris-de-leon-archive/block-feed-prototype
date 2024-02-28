import { auth0 } from "@api/shared/auth0"
import { db } from "@api/shared/database"

export const ENV_FILES = ["webhooks.env", "auth0.env", "node.env", "db.env"]

export const NAMESPACE = "webhooks"

export type Context = Readonly<{
  database: ReturnType<typeof db.core.createClient>
  auth0: ReturnType<typeof auth0.core.createClient>
}>

export const CONSTANTS = {
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
} as const

export const OPERATIONS = {
  CREATE: (() => {
    const name = "Create" as const
    return {
      ID: `${NAMESPACE}${name}`,
      METHOD: "POST",
      NAME: name,
      PATH: `/${NAMESPACE}.${name}`,
    } as const
  })(),
  FIND_MANY: (() => {
    const name = "FindMany" as const
    return {
      ID: `${NAMESPACE}${name}`,
      METHOD: "GET",
      NAME: name,
      PATH: `/${NAMESPACE}.${name}`,
    } as const
  })(),
  FIND_ONE: (() => {
    const name = "FindOne" as const
    return {
      ID: `${NAMESPACE}${name}`,
      METHOD: "GET",
      NAME: name,
      PATH: `/${NAMESPACE}.${name}`,
    } as const
  })(),
  UPDATE: (() => {
    const name = "Update" as const
    return {
      ID: `${NAMESPACE}${name}`,
      METHOD: "POST",
      NAME: name,
      PATH: `/${NAMESPACE}.${name}`,
    } as const
  })(),
  REMOVE: (() => {
    const name = "Remove" as const
    return {
      ID: `${NAMESPACE}${name}`,
      METHOD: "POST",
      NAME: name,
      PATH: `/${NAMESPACE}.${name}`,
    } as const
  })(),
  ACTIVATE: (() => {
    const name = "Activate" as const
    return {
      ID: `${NAMESPACE}${name}`,
      METHOD: "POST",
      NAME: name,
      PATH: `/${NAMESPACE}.${name}`,
    } as const
  })(),
} as const
