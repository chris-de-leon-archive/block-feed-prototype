import { FaUserGroup, FaUser } from "react-icons/fa6"
import { FaCheckCircle } from "react-icons/fa"
import { HiUserGroup } from "react-icons/hi"
import Image from "next/image"
import Link from "next/link"

export function Tiers() {
  return (
    <section className="section bg-landing text-white">
      <div className="container mx-auto">
        <div className="flex flex-col items-center gap-y-5">
          <Image
            className="h-auto w-auto"
            src={"/logos/split.svg"}
            alt="logo-split"
            width={150}
            height={100}
          />
          <div className="flex flex-col items-center gap-y-3">
            <h2 className="text-center text-3xl font-bold">
              Block Feed Pricing
            </h2>
            <h3 className="text-center text-lg opacity-50">
              Pricing for Block Feed Webhooks and Block Feed Dashboard
            </h3>
          </div>
          <div className="flex flex-col gap-y-5 md:grid md:grid-cols-3 md:gap-x-12">
            {tiers.map((tier, i) => (
              <div
                className="flex flex-col items-center justify-between rounded-lg border border-sky-blue p-4 shadow-lg shadow-sky-blue"
                key={i}
              >
                <div className="flex flex-col">
                  <span className="mb-9 text-3xl font-bold">{tier.title}</span>
                  <div className="mb-9 flex flex-row items-center gap-x-5">
                    <span className="text-xl">{tier.icon}</span>
                    <p className="opacity-50">{tier.subtitle}</p>
                  </div>
                  <div className="mb-5 flex flex-row border-b-[1px] border-b-white border-opacity-25 pb-5">
                    {tier.price}
                  </div>
                  <ul className="mb-3 h-full">
                    {tier.features.map((feature, i) => (
                      <div
                        key={i}
                        className="mb-3 flex flex-row items-center gap-x-2"
                      >
                        <div className="text-xl">
                          <FaCheckCircle />
                        </div>
                        <li>{feature}</li>
                      </div>
                    ))}
                  </ul>
                </div>
                <Link
                  className="button-base mt-5 w-full border-2 border-sky-blue border-opacity-50 transition-all ease-linear hover:border-opacity-100"
                  href={tier.href}
                >
                  {tier.callToActionText}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const tiers = [
  {
    title: "Free",
    subtitle: "Ideal for Exploration",
    callToActionText: "Get Started for Free",
    href: "/subscribe",
    icon: <FaUser />,
    price: (
      <>
        <span className="mr-2 text-3xl opacity-75">$0</span>
        <span className="opacity-50">/ 7 days</span>
      </>
    ),
    features: ["Dashboard", "ALL Blockchains", "Community Support"],
  },
  {
    title: "Pro",
    subtitle: "Unlock all Features",
    callToActionText: "Get Started with Pro",
    href: "/subscribe",
    icon: <FaUserGroup />,
    price: (
      <>
        <span className="mr-2 text-3xl opacity-75">$10</span>
        <span className="opacity-50">/ 1K Requests</span>
      </>
    ),
    features: [
      "Dashboard",
      "ALL Blockchains",
      "Standard Support",
      "Analytics",
      "Plugins",
    ],
  },
  {
    title: "Enterprise",
    subtitle: "For More Complex Use Cases",
    callToActionText: "Contact Sales",
    href: "/contact",
    icon: <HiUserGroup />,
    price: <span className="text-3xl opacity-75">Custom</span>,
    features: [
      "Dashboard",
      "ALL Blockchains",
      "Premium Support",
      "Analytics",
      "Plugins",
    ],
  },
] as const
