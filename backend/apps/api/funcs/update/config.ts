import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"
import * as path from "path"

export const funcsUpdateConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.UPDATE.ID]: {
    ...sharedConfig,
    handler: path.join(
      path.dirname(path.relative(process.cwd(), __filename)),
      "handler.handler"
    ),
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
