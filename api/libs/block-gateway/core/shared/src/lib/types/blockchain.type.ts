import { TBlockchainInfo } from "./blockchain-info.type"

export type TBlockchain = {
  getBlockAtHeight: (height: number) => Promise<object>
  getLatestBlockHeight: () => Promise<number>
  getInfo(): TBlockchainInfo
}
