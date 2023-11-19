export const onShutdown = (
  cb: (signalOrCode: NodeJS.Signals | number) => void,
) => {
  // NOTE: if an async callback is passed in for
  // any of these signals / events, node JS will
  // ensure the callback is fully executed before
  // exiting
  process.once("beforeExit", cb)
  process.once("SIGTERM", cb)
  process.once("SIGINT", cb)
}
