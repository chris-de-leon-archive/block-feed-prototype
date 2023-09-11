import { generateOpenApiDocument } from "trpc-openapi"
import { funcsAPI } from "@api/api/funcs/api"
import { trpc } from "@api/shared/trpc"
import * as fs from "node:fs/promises"

const t = trpc.createTRPC()

const appRouter = t.router({
  [funcsAPI.NAMESPACE]: t.router({
    ...funcsAPI.findMany(t),
    ...funcsAPI.findOne(t),
    ...funcsAPI.create(t),
    ...funcsAPI.update(t),
    ...funcsAPI.remove(t),
  }),
})

const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "Block Feed API",
  version: "1.0.0",
  baseUrl: "https://block-feed.io",
})

process.stdout.write("Generating docs... ")
fs.writeFile(
  process.argv[2] != null ? `${process.argv[2]}.json` : "docs.json",
  JSON.stringify(openApiDocument, null, 2)
).then(() => {
  console.log("done!")
})
