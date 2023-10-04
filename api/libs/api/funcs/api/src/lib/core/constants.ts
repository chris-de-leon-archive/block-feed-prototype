import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
export const NAMESPACE = "funcs"

export type FuncsCtx = Readonly<{
  database: NodePgDatabase<typeof database.schema>
  auth0: ReturnType<typeof auth0.createClient>
}>

export const ENV_FILES = ["auth0.env", "api.env"]

export const CONSTANTS = {
  CURSOR_ID: {
    MAX_LEN: Math.pow(2, 8),
    MIN_LEN: 1,
  },
  NAME: {
    MAX_LEN: Math.pow(2, 8),
    MIN_LEN: 1,
  },
  LIMIT: {
    MIN: 0,
    MAX: 25,
  },
  OFFSET: {
    MIN: 0,
  },
}

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
} as const
