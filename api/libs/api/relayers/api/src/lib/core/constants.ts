import { database } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"

export const NAMESPACE = "relayers"

export type Context = Readonly<{
  database: ReturnType<typeof database.core.createClient>
  auth0: ReturnType<typeof auth0.createClient>
}>

export const ENV_FILES = [
  "auth0.env",
  "node.env",
  "api.env",
  "k8s.env",
  "db.env",
]

export const CONSTANTS = {
  NAME: {
    LEN: {
      MAX: database.core.CONSTANTS.SCHEMA.RELAYERS.MAX_NAME_LEN,
      MIN: 1,
    },
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
  DEPLOY: (() => {
    const name = "Deploy" as const
    return {
      ID: `${NAMESPACE}${name}`,
      METHOD: "POST",
      NAME: name,
      PATH: `/${NAMESPACE}.${name}`,
    } as const
  })(),
} as const
