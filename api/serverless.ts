import { config as webhooksFindManyConfig } from "./apps/api/webhooks/find-many/src/config"
import { config as webhooksFindOneConfig } from "./apps/api/webhooks/find-one/src/config"
import { config as webhooksCreateConfig } from "./apps/api/webhooks/create/src/config"
import { config as webhooksRemoveConfig } from "./apps/api/webhooks/remove/src/config"
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
    ...webhooksFindManyConfig,
    ...webhooksFindOneConfig,
    ...webhooksCreateConfig,
    ...webhooksRemoveConfig,
  },
  plugins: [
    // TODO: is localstack still needed?
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
