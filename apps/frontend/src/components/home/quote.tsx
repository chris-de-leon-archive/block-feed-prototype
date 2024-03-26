import Image from "next/image"

export function Quote() {
  return (
    <section className="section bg-landing text-white">
      <div className="container mx-auto">
        <div className="flex flex-col items-center gap-y-12">
          <h2 className="text-blue-glow text-xl text-sky-blue">Product</h2>
          <blockquote className="max-w-3xl text-center text-xl font-light md:text-3xl">
            &quot;BlockFeed is a webhook service that streamlines the process of
            interacting with near realtime blockchain data. As a software
            engineer who has worked in the blockchain space for several years, I
            have constantly found myself in need of a service like this, but
            have never come across one. This drove me to create BlockFeed. I
            hope this service is able to help you as much as it has helped
            me.&quot;
          </blockquote>
          <div className="flex flex-col items-center gap-x-3 gap-y-3">
            <Image
              className="rounded-full shadow-md shadow-sky-blue"
              src="/logos/box.svg"
              alt="profile-pic"
              width={100}
              height={100}
            />
            <p className="font-bold">Chris De Leon</p>
            <p className="opacity-50">Creator of blockfeed.io</p>
          </div>
        </div>
      </div>
    </section>
  )
}
