import { ProgressTimeline } from "../shared/progress-timeline"

export function Workflow() {
  return (
    <section className="section bg-landing text-white">
      <div className="container mx-auto">
        <div className="mb-8 flex flex-col gap-y-5">
          <h2 className="text-blue-glow text-center text-xl text-sky-blue md:text-left">
            Workflow
          </h2>
          <h3 className="max-w-2xl text-center text-5xl font-bold md:text-left">
            How Does it Work?
          </h3>
          <p className="max-w-xl text-center text-xl opacity-50 md:text-left">
            Get up and running in 3 easy steps!
          </p>
        </div>
        <ProgressTimeline
          items={[
            {
              title: "Setup a Receiver",
              description:
                "First you'll need a way to receive data from our service. If you have an API or serverless function in place already, that's perfect! You are ready to move onto the next step. If you don't have one of these, no need to worry. Our documentation will guide you through the process of getting setup with one!",
            },
            {
              title: "Update the BlockFeed Dashboard",
              description:
                "Once you have a service that can receive data, log into the BlockFeed dashboard and create a new webhook. Input details such as your service's URL and customize the webhook as you see fit. Adjust parameters such as the chain, the number of blocks per request, and the number of retry attempts for fault tolerance.",
            },
            {
              title: "Start Receiving Data",
              description:
                "Once you create a webhook in the dashboard, activate it when you are ready to receive data, and our service will begin forwarding blockchain data to your service! In the event your service is down, we will attempt to redeliver the data according to the number of retries configured. Our service is guaranteed to deliver blocks to your service in the order they arrived on the chain, so you don't need to worry about performing additional sorting on your side.",
            },
          ]}
        />
      </div>
    </section>
  )
}
