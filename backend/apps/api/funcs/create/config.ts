import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"

export const funcsCreateConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.CREATE.NAME]: {
    ...sharedConfig,
    handler: "./apps/api/funcs/create/handler.handler",
    events: [
      {
        http: {
          operationId: funcsAPI.OPERATIONS.CREATE.NAME,
          path: funcsAPI.OPERATIONS.CREATE.PATH,
          method: funcsAPI.OPERATIONS.CREATE.METHOD,
        },
      },
    ],
  },
}
