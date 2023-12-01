import { generateOpenApiDocument } from "trpc-openapi"
import { RelayersAPI } from "@api/api/relayers/api"
import { trpc } from "@api/shared/trpc"
import * as fs from "node:fs/promises"

const t = trpc.createTRPC<any>()

const appRouter = t.router({
  [RelayersAPI.NAMESPACE]: t.router({
    [RelayersAPI.OPERATIONS.FIND_MANY.NAME]: RelayersAPI.findMany(t),
    [RelayersAPI.OPERATIONS.FIND_ONE.NAME]: RelayersAPI.findOne(t),
    [RelayersAPI.OPERATIONS.CREATE.NAME]: RelayersAPI.create(t),
    [RelayersAPI.OPERATIONS.UPDATE.NAME]: RelayersAPI.update(t),
    [RelayersAPI.OPERATIONS.REMOVE.NAME]: RelayersAPI.remove(t),
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
  JSON.stringify(openApiDocument, null, 2),
).then(() => {
  console.log("done!")
})
