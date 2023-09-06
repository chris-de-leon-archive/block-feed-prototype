import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"

export const funcsUpdateConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.UPDATE.NAME]: {
    ...sharedConfig,
    handler: "./apps/api/funcs/update/handler.handler",
    events: [
      {
        http: {
          operationId: funcsAPI.OPERATIONS.UPDATE.NAME,
          path: funcsAPI.OPERATIONS.UPDATE.PATH,
          method: funcsAPI.OPERATIONS.UPDATE.METHOD,
        },
      },
    ],
  },
}
