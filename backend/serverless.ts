import { funcsFunctions } from "./apps/api/funcs/functions"
import type { AWS } from "@serverless/typescript"
import { utils } from "./libs/shared/utils"

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
    ...funcsFunctions,
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
      excludeFiles: "./**/*.test.ts",
    },
  },
}

module.exports = config
