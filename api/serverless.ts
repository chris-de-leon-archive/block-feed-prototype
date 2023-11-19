import { config as relayersFindManyConfig } from "./apps/api/relayers/find-many/src/config"
import { config as relayersFindOneConfig } from "./apps/api/relayers/find-one/src/config"
import { config as relayersCreateConfig } from "./apps/api/relayers/create/src/config"
import { config as relayersUpdateConfig } from "./apps/api/relayers/update/src/config"
import { config as relayersRemoveConfig } from "./apps/api/relayers/remove/src/config"
import type { AWS } from "@serverless/typescript"
import { utils } from "@api/shared/utils"

const appEnv = utils.getAppEnv()

const config: AWS = {
  frameworkVersion: "3",
  service: "block-feed",
  provider: {
    name: "aws",
    stage: appEnv,
    runtime: "nodejs18.x",
    endpointType: "REGIONAL",
    region: "us-west-2",
    versionFunctions: false,
    apiGateway: {
      minimumCompressionSize: 1024,
    },
  },
  package: {
    individually: true,
  },
  functions: {
    ...relayersFindManyConfig,
    ...relayersFindOneConfig,
    ...relayersCreateConfig,
    ...relayersUpdateConfig,
    ...relayersRemoveConfig,
  },
  plugins: [
    "serverless-localstack",
    "serverless-webpack",
    "serverless-offline",
  ],
  custom: {
    localstack: {
      stages: [utils.enums.AppEnv.DEV],
      host: "http://localhost:4566",
      debug: true,
    },
    webpack: {
      webpackConfig: "webpack.config.js",
      includeModules: true,
      packager: "npm",
      keepOutputDirectory: true,
      excludeFiles: "./**/*.tests.ts",
    },
  },
}

module.exports = config
