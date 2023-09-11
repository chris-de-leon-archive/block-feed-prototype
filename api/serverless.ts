import { config as funcsFindManyConfig } from "./apps/api/funcs/find-many/src/config"
import { config as funcsFindOneConfig } from "./apps/api/funcs/find-one/src/config"
import { config as funcsCreateConfig } from "./apps/api/funcs/create/src/config"
import { config as funcsUpdateConfig } from "./apps/api/funcs/update/src/config"
import { config as funcsRemoveConfig } from "./apps/api/funcs/remove/src/config"
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
    ...funcsFindManyConfig,
    ...funcsFindOneConfig,
    ...funcsCreateConfig,
    ...funcsUpdateConfig,
    ...funcsRemoveConfig,
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
    // esbuild: {
    //   keepOutputDirectory: true,
    //   define: { "require.resolve": undefined },
    // },
    webpack: {
      webpackConfig: "webpack.config.js",
      includeModules: true,
      packager: "npm",
      keepOutputDirectory: true,
      excludeFiles: "./**/*.test.ts",
    },
  },
}

module.exports = config
