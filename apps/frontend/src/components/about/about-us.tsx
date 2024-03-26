export function AboutUs() {
  return (
    <section className="section bg-landing text-white">
      <div className="container mx-auto">
        <div className="my-24 flex flex-col items-center gap-y-9">
          <h2 className="text-5xl font-bold">About</h2>
          <p className="text-center text-lg opacity-50 md:max-w-3xl">
            BlockFeed is a platform that streamlines the process of interacting
            with near realtime blockchain data via webhooks. It offers
            efficient, fault-tolerant delivery of block data, and allows users
            to interact with multiple chains via a single, unified API.
          </p>
        </div>
      </div>
    </section>
  )
}
