import { withStripeSubscriptionRequired } from "@block-feed/guards/with-stripe-subscription-required"
import { DashboardLayout } from "@block-feed/layouts/dashboard.layout"

export default withStripeSubscriptionRequired(({ user }) => {
  return <DashboardLayout ctx={{ user }}></DashboardLayout>
})
