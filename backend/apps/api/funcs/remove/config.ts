import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"
import * as path from "path"

export const funcsRemoveConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.REMOVE.ID]: {
    ...sharedConfig,
    handler: path.join(
      path.dirname(path.relative(process.cwd(), __filename)),
      "handler.handler"
    ),
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
