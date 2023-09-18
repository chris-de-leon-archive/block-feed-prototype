export type BlockMessage = {
  readonly cursorId: string
  readonly data: object
  readonly pagination: {
    readonly limit: number
    readonly offset: number
  }
}
