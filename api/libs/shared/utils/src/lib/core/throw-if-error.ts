export const throwIfError = (results: PromiseSettledResult<unknown>[]) => {
  results.forEach((r) => {
    if (r.status === "rejected") {
      throw new Error(r.reason)
    }
  })
}
