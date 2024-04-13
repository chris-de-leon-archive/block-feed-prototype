export function World() {
  return (
    <section className="section bg-black text-white">
      <div className="container mx-auto">
        <div className="flex flex-col items-center gap-y-12 text-white">
          <h2 className="text-5xl font-bold">Vision</h2>
          <p className="text-center text-xl opacity-50 md:max-w-2xl">
            We envision a world where BlockFeed becomes one of the leading
            platforms that helps developers build a wide range of decentralized
            applications with both speed and safety
          </p>
          <video className="h-[36rem]" autoPlay loop muted playsInline>
            <source src="/vids/spinning-globe.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  )
}
