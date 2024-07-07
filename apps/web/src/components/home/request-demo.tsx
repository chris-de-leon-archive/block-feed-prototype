import { env } from "@block-feed/web/utils/env"
import Link from "next/link"

export function RequestDemo() {
  return (
    <section className="section bg-landing text-white">
      <div className="container mx-auto">
        <div className="flex flex-col items-center gap-y-16">
          <div className="flex flex-col items-center gap-y-5">
            <h2 className="text-center text-5xl font-bold">
              Ready to Get Started?
            </h2>
            <p className="text-center text-xl opacity-50">
              Begin exploring today - no credit card required!
            </p>
          </div>
          <div className="flex flex-col gap-y-10 md:w-full md:flex-row md:justify-around md:gap-y-0">
            <div className="flex flex-col gap-y-7 rounded-lg border border-sky-blue p-10 shadow-lg shadow-sky-blue md:w-5/12">
              <span className="text-3xl font-medium">Try it out Yourself</span>
              <p className="max-w-md text-xl opacity-50">
                Start developing now for free.
              </p>
              <Link
                className="button-base mt-5 max-w-fit border-2 border-sky-blue border-opacity-50 transition-all ease-linear hover:border-opacity-100"
                href={env.NEXT_PUBLIC_DASHBOARD_URL}
              >
                Try it Now
              </Link>
            </div>
            <div className="flex flex-col gap-y-7 rounded-lg border border-sky-blue p-10 shadow-lg shadow-sky-blue md:w-5/12">
              <span className="text-3xl font-medium">Request a Demo</span>
              <p className="max-w-md text-xl opacity-50">
                Get in touch with an expert.
              </p>
              <Link
                className="button-base mt-5 w-full max-w-fit border-2 border-sky-blue border-opacity-50 transition-all ease-linear hover:border-opacity-100"
                href="/contact"
              >
                Talk to a Representative
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
