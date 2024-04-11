import { withStripeSubscriptionRequired } from "@block-feed/guards/with-stripe-subscription-required"
import { DashboardError } from "@block-feed/components/dashboard/error"
import { DashboardLayout } from "@block-feed/layouts/dashboard.layout"

export default withStripeSubscriptionRequired(({ user }) => {
  return (
    <DashboardLayout ctx={{ user }}>
      <DashboardError />
    </DashboardLayout>
  )
})
