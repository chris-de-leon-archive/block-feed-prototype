import { LandingPageLayout } from "@block-feed/layouts/landing.layout"
import { ContactUs } from "@block-feed/components/about/contact"
import { AboutUs } from "@block-feed/components/about/about-us"
import { Mission } from "@block-feed/components/about/mission"
import { World } from "@block-feed/components/about/world"

export default function About() {
  return (
    <LandingPageLayout>
      <AboutUs />
      <Mission />
      <World />
      <ContactUs />
    </LandingPageLayout>
  )
}
