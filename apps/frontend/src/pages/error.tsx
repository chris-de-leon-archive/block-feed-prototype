import Link from "next/link"

export default function Error() {
  return (
    <section className="section h-screen bg-landing text-white">
      <div className="container mx-auto">
        <div className="flex flex-col items-center gap-y-5">
          <div className="flex flex-col items-center gap-y-3">
            <span className="text-3xl font-bold">Uh oh...</span>
            <span className="text-2xl font-bold">
              An Error Occurred While Processing Your Request
            </span>
          </div>
          <Link className="button-blue-glow max-w-fit" href="/">
            Return Home
          </Link>
        </div>
      </div>
    </section>
  )
}
