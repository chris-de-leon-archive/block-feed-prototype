import { ContactUs } from "@block-feed/web/components/about/contact"
import { AboutUs } from "@block-feed/web/components/about/about-us"
import { Mission } from "@block-feed/web/components/about/mission"
import { World } from "@block-feed/web/components/about/world"

export default function About() {
  return (
    <main>
      <AboutUs />
      <Mission />
      <World />
      <ContactUs />
    </main>
  )
}
