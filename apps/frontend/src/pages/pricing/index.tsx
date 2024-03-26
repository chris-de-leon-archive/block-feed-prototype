import { LandingPageLayout } from "@block-feed/layouts/landing.layout"
import { Tiers } from "@block-feed/components/pricing/tiers"
import { FAQ } from "@block-feed/components/pricing/faq"

export default function Pricing() {
  return (
    <LandingPageLayout>
      <Tiers />
      <FAQ />
    </LandingPageLayout>
  )
}
