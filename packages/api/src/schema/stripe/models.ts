import { builder } from "../../graphql/builder"
import { Stripe } from "stripe"

const StripeSubscriptionStatusValues: Record<
  Stripe.Subscription.Status,
  { value: Stripe.Subscription.Status }
> = {
  incomplete_expired: { value: "incomplete_expired" },
  incomplete: { value: "incomplete" },
  canceled: { value: "canceled" },
  past_due: { value: "past_due" },
  trialing: { value: "trialing" },
  active: { value: "active" },
  paused: { value: "paused" },
  unpaid: { value: "unpaid" },
} as const

export const gqlStripeSubscriptionStatus = builder.enumType(
  "StripeSubscriptionStatus",
  {
    values: StripeSubscriptionStatusValues,
  },
)

export const gqlStripeSubscription = builder.objectRef<{
  id: string
  status: Stripe.Subscription.Status
}>("StripeSubscription")

builder.objectType(gqlStripeSubscription, {
  fields: (t) => ({
    id: t.exposeString("id"),
    status: t.expose("status", {
      type: gqlStripeSubscriptionStatus,
    }),
  }),
})

export const gqlStripeSession = builder.objectRef<{ url: string }>(
  "StripeSession",
)

builder.objectType(gqlStripeSession, {
  fields: (t) => ({
    url: t.exposeString("url"),
  }),
})
