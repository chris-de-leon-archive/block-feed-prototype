import { StripeWebhookEventProducer } from "../../utils/stripe/stripe-webhook-event-producer"
import { StripeVendor } from "@block-feed/vendors"
import { Plugin } from "graphql-yoga"

export type StripeWebhookEventHandlerPluginParams = Readonly<{
  stripeProducer: StripeWebhookEventProducer
  stripeVendor: StripeVendor
  webhookSecret: string
}>

// https://github.com/dotansimha/graphql-yoga/discussions/2139
export function withStripeWebhookEventHandler(
  params: StripeWebhookEventHandlerPluginParams,
): Plugin {
  return {
    async onRequest(opts) {
      const sig = opts.request.headers.get("stripe-signature")
      if (sig != null) {
        // Verifies the webhook signature and gets the event
        const result = await getEvent(
          params.stripeVendor,
          sig,
          params.webhookSecret,
          opts.request,
        )

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

        // Forward the event to a redis stream for processing
        await params.stripeProducer.produce(result.data)

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
  vendor: StripeVendor,
  signature: string,
  secret: string,
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
      data: vendor.client.webhooks.constructEvent(body, signature, secret),
    } as const
  } catch (err) {
    return {
      status: 400,
      msg: "webhook signature verification failed",
    } as const
  }
}
