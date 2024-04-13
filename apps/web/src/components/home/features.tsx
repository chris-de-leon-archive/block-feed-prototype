import Image from "next/image"

export function Features() {
  return (
    <section className="section bg-landing text-white">
      <div className="container mx-auto">
        <div className="mb-24 flex flex-col items-center gap-y-5">
          <h2 className="text-blue-glow text-xl text-sky-blue">Features</h2>
          <h3 className="max-w-3xl text-center text-5xl font-bold">
            Why BlockFeed?
          </h3>
          <p className="max-w-xl text-center text-xl opacity-50">
            What can we offer you in your next project?
          </p>
        </div>
        <div className="flex flex-col items-center gap-y-10 md:gap-y-0">
          <div className="flex items-center justify-between md:w-full md:flex-row">
            <div className="relative hidden sm:flex md:h-[500px] md:w-[500px]">
              <Image
                src="/landing/performance.svg"
                alt="performance-image"
                fill
              />
            </div>
            <div className="flex flex-col gap-y-5">
              <h2 className="text-blue-glow text-center text-xl text-sky-blue md:text-left">
                Performance
              </h2>
              <h3 className="text-center text-5xl font-bold md:max-w-lg md:text-left">
                Blazingly Fast Block Delivery
              </h3>
              <p className="text-center text-xl opacity-50 md:max-w-lg md:text-left">
                Receive blocks with little to no delay. Lightweight processing
                is done by our service between the time a block is confirmed on
                the chain and the time it is sent to you allowing lightning fast
                delivery.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between md:w-full md:flex-row">
            <div className="flex flex-col gap-y-5">
              <h2 className="text-blue-glow text-center text-xl text-sky-blue md:text-left">
                Ease of Use
              </h2>
              <h3 className="text-center text-5xl font-bold md:max-w-lg md:text-left">
                First Class Tooling
              </h3>
              <p className="text-center text-xl opacity-50 md:max-w-lg md:text-left">
                Interact with our service using our SDKs, CLI, or dashboard. Our
                tooling is regularly maintained and backed by a growing
                community of contributors. Eliminate the need for installing
                numerous chain-specific SDKs in your project.
              </p>
            </div>
            <div className="relative hidden sm:flex md:h-[505px] md:w-[480px]">
              <Image src="/landing/computer.svg" alt="computer-image" fill />
            </div>
          </div>
          <div className="flex items-center justify-between md:w-full md:flex-row">
            <div className="relative hidden sm:flex md:h-[475px] md:w-[445px]">
              <Image
                src="/landing/customization.svg"
                alt="customization-image"
                fill
              />
            </div>
            <div className="flex flex-col gap-y-5">
              <h2 className="text-blue-glow text-center text-xl text-sky-blue md:text-left">
                Customization
              </h2>
              <h3 className="text-center text-5xl font-bold md:max-w-lg md:text-left">
                Your Webhooks Your Way
              </h3>
              <p className="text-center text-xl opacity-50 md:max-w-lg md:text-left">
                Our service allows you to tweak a wide range of variables such
                as the number of delivery retries and number of blocks to
                receive in a single request out of the box. You control the way
                you want to receive the data and we deliver!
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
