import { subscriptionsAPI } from "@api/api/subscriptions/api"
import { generateOpenApiDocument } from "trpc-openapi"
import { trpc } from "@api/shared/trpc"
import * as fs from "node:fs/promises"

const t = trpc.createTRPC<subscriptionsAPI.Ctx>()

const appRouter = t.router({
  [subscriptionsAPI.NAMESPACE]: t.router({
    ...subscriptionsAPI.findMany(t),
    ...subscriptionsAPI.findOne(t),
    ...subscriptionsAPI.create(t),
    ...subscriptionsAPI.update(t),
    ...subscriptionsAPI.remove(t),
  }),
})

const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "Block Feed API",
  version: "1.0.0",
  baseUrl: "https://block-feed.io",
})

const filename = process.argv.at(2)
process.stdout.write("Generating docs... ")
fs.writeFile(
  filename != null ? `${filename}.json` : "docs.json",
  JSON.stringify(openApiDocument, null, 2)
).then(() => {
  console.log("done!")
})
