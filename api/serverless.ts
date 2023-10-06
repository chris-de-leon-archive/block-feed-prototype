import { config as subscriptionsFindManyConfig } from "./apps/api/subscriptions/find-many/src/config"
import { config as subscriptionsFindOneConfig } from "./apps/api/subscriptions/find-one/src/config"
import { config as subscriptionsCreateConfig } from "./apps/api/subscriptions/create/src/config"
import { config as subscriptionsUpdateConfig } from "./apps/api/subscriptions/update/src/config"
import { config as subscriptionsRemoveConfig } from "./apps/api/subscriptions/remove/src/config"
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
    ...subscriptionsFindManyConfig,
    ...subscriptionsFindOneConfig,
    ...subscriptionsCreateConfig,
    ...subscriptionsUpdateConfig,
    ...subscriptionsRemoveConfig,
  },
  plugins: ["serverless-localstack", "serverless-webpack"],
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
