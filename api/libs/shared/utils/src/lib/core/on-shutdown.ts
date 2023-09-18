export const onShutdown = (
  cb: (signalOrCode: NodeJS.Signals | number) => void
) => {
  process.on("SIGTERM", (code) => {
    cb(code)
  })
  process.on("SIGINT", (code) => {
    cb(code)
  })
  process.on("exit", (code) => {
    cb(code)
  })
}
