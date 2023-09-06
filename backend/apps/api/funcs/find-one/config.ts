import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"

export const funcsFindOneConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.FIND_ONE.NAME]: {
    ...sharedConfig,
    handler: "./apps/api/funcs/find-one/handler.handler",
    events: [
      {
        http: {
          operationId: funcsAPI.OPERATIONS.FIND_ONE.NAME,
          path: funcsAPI.OPERATIONS.FIND_ONE.PATH,
          method: funcsAPI.OPERATIONS.FIND_ONE.METHOD,
        },
      },
    ],
  },
}
