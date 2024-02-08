import { NodePgDatabase, drizzle } from "drizzle-orm/node-postgres"
import * as testcontainers from "testcontainers"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"
import * as path from "node:path"
import * as pg from "pg"
import { DrizzleConfig } from "drizzle-orm"

export const DB_CONSTANTS = {
  PG: {
    VERSION: "16.1-alpine3.18",
    SCHEMA: "block_feed",
    PORT: 5432,
    DB: "test",
  },
  ROLES: {
    ADMIN: {
      UNAME: "rootuser",
      PWORD: "password",
    },
    API: {
      UNAME: "api_role",
      PWORD: "password",
    },
  },
}

export const spawnDB = async () => {
  const rootDir = utils.getRootDir()

  const container = await testcontainers.GenericContainer.fromDockerfile(
    path.join(rootDir, "db"),
    "Dockerfile",
  )
    .withBuildArgs({ POSTGRES_VERSION: DB_CONSTANTS.PG.VERSION })
    .build()

  return await container
    .withExposedPorts(DB_CONSTANTS.PG.PORT)
    .withEnvironment({
      POSTGRES_PASSWORD: DB_CONSTANTS.ROLES.ADMIN.PWORD,
      POSTGRES_USER: DB_CONSTANTS.ROLES.ADMIN.UNAME,
      POSTGRES_DB: DB_CONSTANTS.PG.DB,
    })
    .withCommand(["postgres", "-c", "log_statement=all"])
    .withWaitStrategy(testcontainers.Wait.forListeningPorts())
    .withLogConsumer((stream) => {
      //  stream.on("data", (line) => console.log(line))
      stream.on("err", (line) => console.error(line))
    })
    .start()
}

export const withDatabaseConn = async <T>(
  url: string,
  cb: (
    ctx: Readonly<{
      db: NodePgDatabase<typeof database.schema>
    }>,
  ) => Promise<T> | T,
) => {
  const conn = new pg.Client({ connectionString: url })
  await conn.connect()
  try {
    const db = drizzle(conn, {
      schema: database.schema,
    })
    return await cb({ db })
  } finally {
    await conn.end()
  }
}

export const getPostgresUrl = (
  container: testcontainers.StartedTestContainer,
  uname: string,
  pword: string,
) => {
  return `postgres://${uname}:${pword}@host.docker.internal:${container.getMappedPort(
    DB_CONSTANTS.PG.PORT,
  )}/${DB_CONSTANTS.PG.DB}?sslmode=disable&search_path=${
    DB_CONSTANTS.PG.SCHEMA
  }`
}

export const getAdminRoleUrl = (
  container: testcontainers.StartedTestContainer,
) =>
  getPostgresUrl(
    container,
    DB_CONSTANTS.ROLES.ADMIN.UNAME,
    DB_CONSTANTS.ROLES.ADMIN.PWORD,
  )

export const getApiRoleUrl = (container: testcontainers.StartedTestContainer) =>
  getPostgresUrl(
    container,
    DB_CONSTANTS.ROLES.API.UNAME,
    DB_CONSTANTS.ROLES.API.PWORD,
  )
