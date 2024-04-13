import { TypeWriter } from "../shared/animated/typewriter"
import { env } from "../../utils/env"
import Image from "next/image"
import Link from "next/link"

export function Banner() {
  return (
    <section className="section bg-landing text-white md:h-screen">
      <div className="container mx-auto h-full">
        <div className="flex h-full flex-col items-center md:justify-around">
          <div className="flex h-full flex-col items-center justify-around md:h-auto md:w-full md:flex-row md:items-center md:justify-between">
            <div className="mb-8 flex h-full flex-col items-center justify-around gap-y-7 md:h-auto md:max-w-lg md:items-start md:justify-normal">
              <Image
                className="h-auto w-auto"
                src={"/logos/split.svg"}
                alt="logo-split"
                width={150}
                height={100}
              />
              <div className="flex flex-col items-center gap-y-2 md:items-start">
                <span className="text-center text-4xl font-bold md:text-left md:text-6xl">
                  Blockchain Data Delivery Made
                </span>
                <TypeWriter
                  className="text-blue-glow whitespace-nowrap text-center text-4xl font-bold text-sky-blue md:text-left md:text-6xl"
                  words={["Simple ", "Efficient ", "Fault Tolerant "]}
                  typingDelayMs={100}
                  typingPauseMs={2000}
                />
              </div>
              <p className="text-md text-center opacity-75 md:max-w-3xl md:text-left md:text-xl">
                Harness the power of near real-time blockchain block data and
                eliminate the need for continuous polling or unreliable
                websockets
              </p>
              <div className="flex flex-row gap-x-5">
                <Link
                  className="button-blue-glow max-w-fit"
                  href={env.NEXT_PUBLIC_DASHBOARD_URL}
                >
                  Get Started
                </Link>
                <Link className="button-white-glow" href="/docs">
                  Learn More
                </Link>
              </div>
            </div>
            <div className="relative h-[300px] w-[300px] md:h-[500px] md:w-[500px]">
              <Image fill src="/landing/cloud.svg" alt="cloud-image" priority />
            </div>
          </div>
          <div className="flex h-full w-full flex-col justify-around gap-y-7 md:h-auto md:w-full">
            <span className="text-center text-2xl">
              Powered by the World&apos;s Leading Chains
            </span>
            <div className="gradient-mask flex flex-row items-center overflow-hidden">
              <Chains />
              <Chains />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Chains() {
  return (
    <div className="flex animate-scroll-l-infinite flex-row space-x-12 px-6">
      {chains.map((chain, i) => {
        return (
          <div className="flex flex-col items-center justify-center" key={i}>
            <div className="w-12 overflow-clip rounded-full">
              <Image
                src={chain.img.src}
                alt={chain.img.alt}
                width={100}
                height={100}
              />
            </div>
            <p className="mt-1">{chain.name}</p>
          </div>
        )
      })}
    </div>
  )
}

const chains = [
  {
    name: "Ethereum",
    img: { src: "/blockchains/eth.png", alt: "eth-logo" },
  },
  {
    name: "Flow",
    img: { src: "/blockchains/flow.png", alt: "flow-logo" },
  },
  {
    name: "Starknet",
    img: { src: "/blockchains/starknet.png", alt: "starknet-logo" },
  },
  {
    name: "Tron",
    img: { src: "/blockchains/tron.webp", alt: "tron-logo" },
  },
  {
    name: "Stellar",
    img: { src: "/blockchains/stellar.png", alt: "stellar-logo" },
  },
  {
    name: "Solana",
    img: { src: "/blockchains/solana.png", alt: "solana-logo" },
  },
  {
    name: "Polygon",
    img: { src: "/blockchains/polygon.webp", alt: "polygon-logo" },
  },
  {
    name: "Avalanche",
    img: { src: "/blockchains/avalanche.png", alt: "avalanche-logo" },
  },
  {
    name: "Optimism",
    img: { src: "/blockchains/optimism.png", alt: "optimism-logo" },
  },
  {
    name: "Fantom",
    img: { src: "/blockchains/fantom.png", alt: "fantom-logo" },
  },
  {
    name: "Axelar",
    img: { src: "/blockchains/axelar.avif", alt: "axelar-logo" },
  },
  {
    name: "Ripple",
    img: { src: "/blockchains/ripple.png", alt: "ripple-logo" },
  },
  {
    name: "Arbitrum",
    img: { src: "/blockchains/arb.png", alt: "arbitrum-logo" },
  },
  {
    name: "Scroll",
    img: { src: "/blockchains/scroll.png", alt: "scroll-logo" },
  },
  {
    name: "Tezos",
    img: { src: "/blockchains/tezos.png", alt: "tezos-logo" },
  },
]
