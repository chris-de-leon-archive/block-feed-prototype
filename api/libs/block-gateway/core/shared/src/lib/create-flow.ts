import { TBlockGatewayJob } from "./types/block-gateway-job.type"
import { FlowProducer, FlowOpts } from "bullmq"

export class StronglyTypedFlowProducer extends FlowProducer {
  override async add(flow: TBlockGatewayJob, opts?: FlowOpts | undefined) {
    return await super.add(flow, opts)
  }

  override async addBulk(flows: TBlockGatewayJob[]) {
    return await super.addBulk(flows)
  }
}

export const createFlow = (url: URL) => {
  return new StronglyTypedFlowProducer({
    connection: {
      host: url.hostname,
      port: Number(url.port),
      offlineQueue: false,
    },
  }).on("error", (err) => {
    console.error(`error: ${err}`)
  })
}
