import * as testcontainers from "testcontainers"
import { getRootDir } from "../test-utils"
import { VerboseOptions } from "./utils"
import * as path from "node:path"

export const DB_CONSTANTS = {
  MYSQL: {
    VERSION: "8.3.0",
    PORT: 3306,
    DB: "test",
  },
  ROLES: {
    ROOT: {
      UNAME: "root",
      PWORD: "password",
    },
    API: {
      UNAME: "api_user",
      PWORD: "password",
    },
  },
}

export const spawn = async (verbose: VerboseOptions) => {
  const rootDir = getRootDir()

  const container = await testcontainers.GenericContainer.fromDockerfile(
    path.join(rootDir, "vendor", "mysql"),
    "Dockerfile",
  )
    .withBuildArgs({ MYSQL_VERSION: DB_CONSTANTS.MYSQL.VERSION })
    .build(`mysql-dev:${DB_CONSTANTS.MYSQL.PORT}`)

  return await container
    .withExposedPorts(DB_CONSTANTS.MYSQL.PORT)
    .withEnvironment({
      MYSQL_ROOT_PASSWORD: DB_CONSTANTS.ROLES.ROOT.PWORD,
      MYSQL_DATABASE: DB_CONSTANTS.MYSQL.DB,
    })
    .withWaitStrategy(testcontainers.Wait.forListeningPorts())
    .withLogConsumer((stream) => {
      if (verbose.data) {
        stream.on("data", console.log)
      }
      if (verbose.errors) {
        stream.on("err", console.error)
      }
    })
    .start()
}

export const getMySqlUrl = (
  container: testcontainers.StartedTestContainer,
  uname: string,
  pword: string,
) => {
  return `mysql://${uname}:${pword}@host.docker.internal:${container.getMappedPort(
    DB_CONSTANTS.MYSQL.PORT,
  )}/${DB_CONSTANTS.MYSQL.DB}`
}

export const getRootUserUrl = (
  container: testcontainers.StartedTestContainer,
) =>
  getMySqlUrl(
    container,
    DB_CONSTANTS.ROLES.ROOT.UNAME,
    DB_CONSTANTS.ROLES.ROOT.PWORD,
  )

export const getApiUserUrl = (container: testcontainers.StartedTestContainer) =>
  getMySqlUrl(
    container,
    DB_CONSTANTS.ROLES.API.UNAME,
    DB_CONSTANTS.ROLES.API.PWORD,
  )
