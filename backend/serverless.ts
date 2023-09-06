import { funcsFunctions } from "./apps/api/funcs/functions"
import type { AWS } from "@serverless/typescript"
import { utils } from "./libs/shared/utils"

const config: AWS = {
  frameworkVersion: "3",
  service: "block-feed",
  provider: {
    name: "aws",
    stage: utils.getAppEnv(),
    runtime: "nodejs18.x",
    endpointType: "REGIONAL",
    region: "us-west-2",
    versionFunctions: false,
    apiGateway: {
      minimumCompressionSize: 1024,
    },
  },
  functions: {
    ...funcsFunctions,
  },
  plugins: ["serverless-plugin-typescript", "serverless-offline"],
  custom: {
    serverlessPluginTypescript: {
      tsConfigFileLocation: "./tsconfig.serverless.json",
    },
  },
}

module.exports = config
