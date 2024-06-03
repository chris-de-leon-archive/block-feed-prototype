import * as testcontainers from "testcontainers"
import { getRootDir } from "../test-utils"
import { getRandomPort } from "./utils"
import * as path from "node:path"

export const REDIS_CLUSTER_CONSTANTS = {
  MIN_NODES: 6,
}

export const spawn = async () => {
  const randPort = await getRandomPort()
  const rootDir = getRootDir()

  const compose = await new testcontainers.DockerComposeEnvironment(
    path.join(rootDir, "vendor", "redis-cluster"),
    "node.compose.yml",
  )
    .withBuild()
    .withEnvironment({
      START_PORT: randPort.toString(),
      END_PORT: (randPort + REDIS_CLUSTER_CONSTANTS.MIN_NODES).toString(),
    })
    .up()

  return {
    url: `host.docker.internal:${randPort}`,
    compose,
  }
}
