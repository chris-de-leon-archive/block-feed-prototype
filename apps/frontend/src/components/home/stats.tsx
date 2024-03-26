import { Counter } from "../shared/animated/counter"

export function Stats() {
  return (
    <section className="section bg-landing text-white">
      <div className="container mx-auto">
        <div className="flex h-full flex-col items-center gap-y-10 md:gap-y-20">
          <div className="flex flex-col items-center gap-y-7">
            <h2 className="text-blue-glow text-xl text-sky-blue">
              Facts and Figures
            </h2>
            <h3 className="text-center text-5xl font-bold">
              Don&apos;t Take Our Word For It
            </h3>
            <p className="text-center text-xl opacity-50 md:max-w-2xl">
              The numbers speak for themselves
            </p>
          </div>
          <div className="flex flex-col items-center gap-y-10 md:w-full md:flex-row md:justify-around md:gap-y-0">
            <div className="flex flex-col items-center gap-y-3 md:w-1/3">
              <Counter
                className="text-blue-glow text-6xl font-bold text-sky-blue"
                start={0}
                final={100}
                formatter={(num) => `${num}M+`}
                // Gradually slow down the animation as we get to the end
                getIncrDelayMs={(ctx) => Math.pow(1.045, ctx.state.num)}
              />
              <span className="text-center text-lg opacity-50">
                Blocks Delivered
              </span>
            </div>
            <div className="flex flex-col items-center gap-y-3 md:w-1/3">
              <Counter
                className="text-blue-glow text-6xl font-bold text-sky-blue"
                start={0}
                final={1000}
                formatter={(num) => `${num}GB+`}
                // Gradually slow down the animation as we get to the end
                getIncrDelayMs={(ctx) => Math.pow(1.00001, ctx.state.num)}
              />
              <span className="text-center text-lg opacity-50">
                Data Processed
              </span>
            </div>
            <div className="flex flex-col items-center gap-y-3 md:w-1/3">
              <Counter
                className="text-blue-glow text-6xl font-bold text-sky-blue"
                start={0}
                final={15}
                formatter={(num) => `${num}+`}
                // Gradually slow down the animation as we get to the end
                getIncrDelayMs={(ctx) => Math.pow(1.57, ctx.state.num)}
              />
              <span className="text-center text-lg opacity-50">
                Blockchains Integrated
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
