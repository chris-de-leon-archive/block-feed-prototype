export const StripeEventFixture = (
  type:
    | "checkout.session.completed"
    | "customer.subscription.paused"
    | "customer.subscription.created"
    | "customer.subscription.deleted"
    | "customer.subscription.updated"
    | "customer.subscription.resumed",
) => ({
  type,
  data: {
    object: {
      metadata: {
        userId: "dummy-id",
      },
    },
  },
})
