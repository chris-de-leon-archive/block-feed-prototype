import { EventEmitter } from "node:events"

export abstract class BlockGatewayService {
  protected readonly aborter: AbortController
  protected readonly emitter: EventEmitter
  private hasBeenStarted = false

  constructor() {
    this.aborter = new AbortController()
    this.emitter = new EventEmitter()
  }

  protected abstract run(): Promise<() => Promise<void>>

  public async start() {
    // Throws an error if this service has already been stopped
    this.aborter.signal.throwIfAborted()

    // Throws an error if the user is attempting to call `start` more than once
    if (this.hasBeenStarted) {
      throw new Error("Service has already been started")
    } else {
      this.hasBeenStarted = true
    }

    // Runs the service
    const cleanup = await this.run()

    // Exits gracefully when `stop` is called
    this.aborter.signal.onabort = async () => {
      await cleanup()
      this.emitter.emit("abort")
    }
  }

  public async stop() {
    // Returns early if this service has already been stopped
    if (this.aborter.signal.aborted) {
      return
    }

    // Stops the service (waits for the onabort callback to completely finish)
    await new Promise<void>((res) => {
      this.emitter.once("abort", res)
      this.aborter.abort()
    })
  }
}
