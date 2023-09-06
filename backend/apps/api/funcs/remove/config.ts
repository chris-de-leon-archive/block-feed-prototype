import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"

export const funcsRemoveConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.REMOVE.NAME]: {
    ...sharedConfig,
    handler: "./apps/api/funcs/remove/handler.handler",
    events: [
      {
        http: {
          operationId: funcsAPI.OPERATIONS.REMOVE.NAME,
          path: funcsAPI.OPERATIONS.REMOVE.PATH,
          method: funcsAPI.OPERATIONS.REMOVE.METHOD,
        },
      },
    ],
  },
}
