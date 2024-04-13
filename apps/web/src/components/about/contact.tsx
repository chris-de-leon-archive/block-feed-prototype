import Link from "next/link"

export function ContactUs() {
  return (
    <section className="section bg-landing">
      <div className="container mx-auto">
        <div className="my-24 flex flex-col items-center gap-y-12 text-white">
          <h2 className="text-5xl font-bold">Contact Us</h2>
          <p className="text-center text-xl opacity-50 md:max-w-2xl">
            If you&apos;d like to help sponser the project, become an investor,
            or want to have a general chat with the team, please don&apos;t
            hesitate to reach out to us!
          </p>
          <Link className="button-blue-glow max-w-fit" href="/contact">
            Contact Form
          </Link>
        </div>
      </div>
    </section>
  )
}
