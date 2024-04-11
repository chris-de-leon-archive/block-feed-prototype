import { stripe } from "@block-feed/server/vendor/stripe"
import { Plugin } from "graphql-yoga"
import Stripe from "stripe"

export type StripeWebhookEventHandler<T> = (
  ctx: T & { req: Request },
  event: Stripe.Event,
) => void | Promise<void>

export type StripeWebhookEventHandlerPluginParams<T> = Readonly<{
  stripe: ReturnType<typeof stripe.client.create>
  handler: StripeWebhookEventHandler<T>
  context: T
}>

// https://github.com/dotansimha/graphql-yoga/discussions/2139
export function withStripeWebhookEventHandler<T>(
  params: StripeWebhookEventHandlerPluginParams<T>,
): Plugin {
  return {
    async onRequest(opts) {
      const sig = opts.request.headers.get("stripe-signature")
      if (sig != null) {
        // Verifies the webhook signature and gets the event
        const result = await getEvent(params.stripe, sig, opts.request)

        // Handles any errors
        if (result.status !== 200) {
          return opts.endResponse(
            new opts.fetchAPI.Response(
              JSON.stringify({ msg: result.msg }, null, 2),
              {
                status: result.status,
                headers: {
                  "Content-Type": "application/json",
                },
              },
            ),
          )
        }

        // TODO: add webhook event to a redis stream for processing

        // Processes the event
        try {
          await params.handler(
            { ...params.context, req: opts.request },
            result.data,
          )
        } catch (err) {
          console.error(
            `an unhandled error occurred while processing event: ${JSON.stringify(result.data, null, 2)}`,
          )
          console.error(err)
          return opts.endResponse(
            new opts.fetchAPI.Response(null, {
              status: 500,
              headers: {
                "Content-Type": "application/json",
              },
            }),
          )
        }

        // Returns a success message
        return opts.endResponse(
          new opts.fetchAPI.Response(null, {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }),
        )
      }
    },
  }
}

const getEvent = async (
  { client, env }: ReturnType<typeof stripe.client.create>,
  signature: string,
  req: Request,
) => {
  const body = await req.text().catch(() => null)
  if (body == null) {
    return {
      status: 400,
      msg: "bad request body",
    } as const
  }

  try {
    return {
      status: 200,
      data: client.webhooks.constructEvent(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      ),
    } as const
  } catch (err) {
    return {
      status: 400,
      msg: "webhook signature verification failed",
    } as const
  }
}
