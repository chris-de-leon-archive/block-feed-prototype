import { Accordian, AccordianProps } from "../shared/accordian"

export function FAQ() {
  return (
    <div className="section bg-landing">
      <div className="container mx-auto">
        <div className="flex flex-col items-center gap-y-10">
          <div className="flex flex-col items-center gap-y-3">
            <h2 className="text-center text-3xl text-white md:text-left">
              Frequently Asked Questions
            </h2>
            <p className="text-md text-center text-white opacity-75 md:text-left">
              Can&apos;t find an answer to your question? Please reach out on
              our socials!
            </p>
          </div>
          <div className="flex flex-col gap-y-5">
            {items.map((item, i) => (
              <Accordian key={i} {...item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const items: AccordianProps[] = [
  {
    title: "When do I get charged?",
    content:
      "Your credit card will be charged at the end of the calendar month. You will be charged based on the cumulative cost of all the requests sent to all your webhooks (which includes both successful ones and failed ones).",
  },
  {
    title: "Can I cancel or downgrade?",
    content:
      "Yes. You can downgrade to the free tier at any time. Cancellations will take effect at the end of the billing term.",
  },
  {
    title: "What happens if I exceed the monthly limit on the free tier?",
    content:
      "Our service will stop forwarding data to your webhook(s) until the next month or until you upgrade to a higher tier. Your webhook(s) will still remain in your dashboard, and we will resume sending data from the last block that was sent to your service.",
  },
  {
    title: "What payment methods are available?",
    content: "Checkout via credit card is available.",
  },
]
