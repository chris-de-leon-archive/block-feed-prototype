import { TCollectionGuarantee } from "./collection-guarantee.type"
import { TBlockSeal } from "./block-seal.type"

export type TBlock = Readonly<{
  id: string // '03d40910037d575d52831647b39814f445bc8cc7ba8653286c0eb1473778c34f'
  parentId: string // '0000000000000000000000000000000000000000000000000000000000000000'
  height: number // 0
  timestamp: string // '2018-12-19T22:32:30.000000042Z'
  collectionGuarantees: TCollectionGuarantee[] // [ { collectionId: '9675fb9a2b6c23b83434f3a6ae24b720655864c41504309b32b196d50d6ad1fe', signerIds: undefined } ]
  blockSeals: TBlockSeal[] // [ { blockId: '05f1eb5042dc1e2282ad612c8eaa8112556033cf820b01c7b6f6d472ebf5557b', executionReceiptId: '047b951503253007ad203be1b598bd142d53b6df77371bfdcb3498cbb6d7b178' } ]
}>
