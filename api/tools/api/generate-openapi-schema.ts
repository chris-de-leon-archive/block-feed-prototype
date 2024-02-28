import { generateOpenApiDocument } from "trpc-openapi"
import { WebhooksAPI } from "@api/api/webhooks/api"
import { randomUUID } from "node:crypto"
import { trpc } from "@api/shared/trpc"
import * as fs from "node:fs/promises"

const t = trpc.createTRPC<any>()

const appRouter = t.router({
  [WebhooksAPI.NAMESPACE]: t.router({
    [WebhooksAPI.OPERATIONS.FIND_MANY.NAME]: WebhooksAPI.findMany(t),
    [WebhooksAPI.OPERATIONS.ACTIVATE.NAME]: WebhooksAPI.activate(t),
    [WebhooksAPI.OPERATIONS.FIND_ONE.NAME]: WebhooksAPI.findOne(t),
    [WebhooksAPI.OPERATIONS.CREATE.NAME]: WebhooksAPI.create(t),
    [WebhooksAPI.OPERATIONS.REMOVE.NAME]: WebhooksAPI.remove(t),
    [WebhooksAPI.OPERATIONS.UPDATE.NAME]: WebhooksAPI.update(t),
  }),
})

const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "Block Feed API",
  version: "1.0.0",
  baseUrl: "https://block-feed.io",
})

const filename = process.argv.at(2) ?? `${randomUUID()}.openapi.schema`
process.stdout.write("Generating Open API schema... ")
fs.writeFile(`${filename}.json`, JSON.stringify(openApiDocument, null, 2)).then(
  () => {
    console.log("done!")
  },
)
