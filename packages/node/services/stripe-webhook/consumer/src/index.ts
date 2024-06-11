import { stripe } from "@block-feed/node-providers-stripe"
import { redis } from "@block-feed/node-providers-redis"
import { mysql } from "@block-feed/node-providers-mysql"
import { AsyncCache } from "@block-feed/node-caching"
import { setInterval } from "node:timers/promises"
import * as schema from "@block-feed/node-db"
import { eq } from "drizzle-orm"
import { Stripe } from "stripe"

// NOTE: all Stripe webhook event handlers defined by this class are designed to be idempotent:
//
//  https://docs.stripe.com/webhooks#handle-duplicate-events
//
// ALL handlers are resilient to errors and don't need to be retried if an error occurs. For example,
// if we fail to invalidate a cached subscription, then it will still be removed bc when it is first
// inserted we set a short expiration on it. Similarly if we aren't able to delete a customer from
// the database, it will still be detected by the API and removed at a later time.
//
export class StripeWebhookEventConsumer {
  private constructor(
    private readonly stripeCheckoutSessCache: AsyncCache<Stripe.Checkout.Session>,
    private readonly stripeProvider: stripe.Provider,
    private readonly redisProvider: redis.Provider,
    private readonly dbProvider: mysql.Provider,
    private readonly consumerGroupName: string,
    private readonly consumerName: string,
  ) {}

  static async build(
    stripeCheckoutSessCache: AsyncCache<Stripe.Checkout.Session>,
    stripeProvider: stripe.Provider,
    redisProvider: redis.Provider,
    dbProvider: mysql.Provider,
    consumerGroupName: string,
    consumerName: string,
  ) {
    try {
      await redisProvider.client.xgroup(
        "CREATE",
        stripeProvider.constants.STREAMING.WEBHOOK_EVENT_STREAM_NAME,
        consumerGroupName,
        "$", // if a new consumer group is created, start reading new messages from the stream (don't start from the beginning)
        "MKSTREAM",
      )
    } catch (err) {
      // Ignore the error if the consumer group already exists
      if (err instanceof Error && err.message.includes("BUSYGROUP")) {
        return new StripeWebhookEventConsumer(
          stripeCheckoutSessCache,
          stripeProvider,
          redisProvider,
          dbProvider,
          consumerGroupName,
          consumerName,
        )
      }
      throw err
    }

    return new StripeWebhookEventConsumer(
      stripeCheckoutSessCache,
      stripeProvider,
      redisProvider,
      dbProvider,
      consumerGroupName,
      consumerName,
    )
  }

  async *consume(controller: AbortController, blockMs = 0) {
    // Start processing from the beginning of the stream
    let cursorId = "0-0"

    // NOTE: a while loop should not be used here bc it will block kill signals from being
    // emitted. Instead, we use the async/await version of setInterval to ensure the event
    // loop is not blocked: https://github.com/nodejs/node/issues/9050
    for await (const _ of setInterval(1, undefined)) {
      // If the controller signal has been aborted, then exit the loop
      if (controller.signal.aborted) {
        break
      }

      // xreadgroup will return null if the block timeout expires
      // otherwise it will return something like the example below:
      //
      // [
      //   [
      //     <stream-0>,
      //     [
      //       [ <msgID>, [ <key1>, <val1>, <key2>, <val2>, ... ] ],
      //       ...
      //     ],
      //   ],
      //   [
      //     <stream-1>,
      //     [
      //       [ <msgID>, [ <key1>, <val1>, <key2>, <val2>, ... ] ],
      //       ...
      //     ]
      //   ],
      //   ...
      // ]
      //
      const streams = await this.redisProvider.client.xreadgroup(
        "GROUP",
        this.consumerGroupName,
        this.consumerName,
        "COUNT",
        1, // only read one msg at a time
        "BLOCK",
        blockMs,
        "STREAMS",
        this.stripeProvider.constants.STREAMING.WEBHOOK_EVENT_STREAM_NAME,
        cursorId,
      )

      // Checks if the block timeout expired (only applicable if `blockMs` != 0)
      if (streams == null) {
        yield []
        continue
      }

      // Iterate over the result to find the stream we're interested in
      for (const stream of streams) {
        // Validate that `stream` is an array
        if (!Array.isArray(stream)) {
          throw new Error(`could not parse xreadgroup result: ${stream}`)
        }

        // Validate that `stream` has two elements
        const [streamName, msgs] = [stream.at(0), stream.at(1)]
        if (typeof streamName !== "string") {
          throw new Error(`could not parse stream name: ${stream}`)
        }
        if (!Array.isArray(msgs)) {
          throw new Error(`could not parse messages: ${stream}`)
        }

        // Check if the current stream is the one we're interested in
        if (
          streamName !==
          this.stripeProvider.constants.STREAMING.WEBHOOK_EVENT_STREAM_NAME
        ) {
          continue
        }

        // Handle the case when no messages were received
        if (msgs.length === 0) {
          if (cursorId === "0-0") {
            // If the backlog is empty, move onto processing new messages
            cursorId = ">"
          } else {
            // If we read no new messages, then go back to the beginning of the backlog and work our way back here
            cursorId = "0-0"
          }
          break
        }

        // Parse the message(s)
        const parsedMsgs = Object.fromEntries(
          msgs.map((msg) => {
            if (!Array.isArray(msg)) {
              throw new Error(`invalid message: ${msg}`)
            }

            const [id, data] = [msg.at(0), msg.at(1)]
            if (typeof id !== "string") {
              throw new Error(`invalid message ID: ${msg}`)
            }
            if (!Array.isArray(data)) {
              throw new Error(`invalid message data: ${msg}`)
            }

            const [key, rawVal] = [data.at(0), data.at(1)]
            if (typeof key !== "string") {
              throw new Error(`invalid key: ${msg}`)
            }
            if (typeof rawVal !== "string") {
              throw new Error(`invalid value: ${msg}`)
            }

            const val = JSON.parse(rawVal)
            return [id, { key, val }] as const
          }),
        )

        // Idempotently process the message(s)
        const stripeEvents = new Map<
          string,
          { id: string; data: Stripe.Event; err: Error | undefined }
        >()
        for (const [id, { val: event }] of Object.entries(parsedMsgs)) {
          stripeEvents.set(id, {
            id,
            data: event,
            err: await this.consumeEvent(event)
              .then(() => undefined)
              .catch((err) => {
                const msg = `an error occurred while processing event "${event.type}" with message ID "${id}":\n`
                if (err instanceof Error) {
                  return new Error(msg.concat(err.message))
                } else {
                  return new Error(msg.concat(String(err)))
                }
              }),
          })
        }

        // Ack, delete, and yield the messages
        if (stripeEvents.size !== 0) {
          // Ack and delete all the messages
          await this.redisProvider.client.xackdel(
            this.stripeProvider.constants.STREAMING.WEBHOOK_EVENT_STREAM_NAME,
            this.consumerGroupName,
            ...Array.from(stripeEvents.keys()),
          )

          // Yield all the events (both successful and unsuccessful ones)
          yield Array.from(stripeEvents.values())
        }

        // Once we've processed the messages of the stream that we're interested in, then
        // there's no need to iterate further - we can break early and repeat the process
        break
      }
    }
  }

  private async consumeEvent(event: Stripe.Event) {
    switch (event.type) {
      case "checkout.session.completed":
        await this.invalidateCachedSubscription(event)
        break
      case "invoice.paid":
        await this.invalidateCachedSubscription(event)
        break
      case "invoice.payment_failed":
        await this.invalidateCachedSubscription(event)
        break
      case "invoice.payment_succeeded":
        await this.invalidateCachedSubscription(event)
        break
      case "invoice.upcoming":
        // TODO: send email
        break
      case "customer.deleted":
        await this.handleCustomerDeleted(event)
        break
      case "customer.subscription.deleted":
        await this.invalidateCachedSubscription(event)
        break
      case "customer.subscription.updated":
        await this.invalidateCachedSubscription(event)
        break
      case "customer.subscription.created":
        await this.invalidateCachedSubscription(event)
        break
      case "customer.subscription.resumed":
        await this.invalidateCachedSubscription(event)
        break
      case "customer.subscription.paused":
        await this.invalidateCachedSubscription(event)
        break
      case "customer.subscription.trial_will_end":
        // TODO: send email
        break
      default:
        // Unhandled event type
        console.log(`Unhandled event type "${event.type}"`)
        return
    }
  }

  private async handleCustomerDeleted(
    event: Stripe.Event & { type: "customer.deleted" },
  ) {
    const subscriptions = await this.stripeProvider.client.subscriptions.list({
      customer: event.data.object.id,
      limit: 1,
    })

    const sub = subscriptions.data.at(0)
    if (sub == null) {
      console.log(
        `no subscriptions detected for user with ID "${event.data.object.id}"`,
      )
      return
    }

    // NOTE: removing a customer from the database is a best-effort operation.
    // If they can't be removed, then this is okay - the checkout session logic
    // will detect that the customer has been deleted and clean up the old data
    const metadata = this.stripeProvider.parseMetadata(sub.metadata)
    await Promise.allSettled([
      this.stripeCheckoutSessCache.invalidate(metadata.userId),
      this.dbProvider.drizzle.transaction(async (tx) => {
        await tx
          .delete(schema.checkoutSession)
          .where(eq(schema.checkoutSession.customerId, metadata.userId))
      }),
    ]).then(this.handlePromiseSettledResults)
  }

  private async invalidateCachedSubscription(
    event: Stripe.Event & {
      type:
        | "checkout.session.completed"
        | "customer.subscription.paused"
        | "customer.subscription.created"
        | "customer.subscription.deleted"
        | "customer.subscription.updated"
        | "customer.subscription.resumed"
        | "invoice.payment_succeeded"
        | "invoice.payment_failed"
        | "invoice.paid"
    },
  ) {
    const getMetadata = async () => {
      if (event.type === "checkout.session.completed") {
        return this.stripeProvider.parseMetadata(
          event.data.object.metadata ?? {},
        )
      }

      if (
        event.type === "customer.subscription.paused" ||
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.deleted" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.resumed"
      ) {
        return this.stripeProvider.parseMetadata(event.data.object.metadata)
      }

      const subscription = event.data.object.subscription
      if (subscription == null) {
        throw new Error(
          `subscription is missing in checkout session event:\n${JSON.stringify(event, null, 2)}`,
        )
      }

      const sub =
        typeof subscription === "string"
          ? await this.stripeProvider.client.subscriptions.retrieve(
              subscription,
            )
          : subscription

      return this.stripeProvider.parseMetadata(sub.metadata)
    }

    await this.stripeCheckoutSessCache.invalidate(
      await getMetadata().then(({ userId }) => userId),
    )
  }

  private handlePromiseSettledResults(
    results: PromiseSettledResult<unknown>[],
  ) {
    const errs = new Array<Error>()
    results.forEach((result) => {
      if (result.status === "rejected") {
        errs.push(result.reason)
      }
    })
    if (errs.length > 0) {
      throw new Error(JSON.stringify(errs, null, 2))
    }
  }
}
