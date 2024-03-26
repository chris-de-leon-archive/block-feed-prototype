import { useRouter } from "next/router"

export type DashboardErrorProps = Readonly<{
  msg?: string
}>

export function DashboardError(props: DashboardErrorProps) {
  const router = useRouter()
  return (
    <div className="flex h-full w-full items-center justify-center text-white">
      <div className="flex flex-col items-center gap-y-5">
        <span className="text-5xl font-bold">Uh Oh...</span>
        <span className="text-4xl">
          {props.msg ?? "An error occurred while loading the dashboard"}
        </span>
        <button
          className="rounded-lg border border-sky-blue p-3 transition-all ease-linear hover:opacity-50"
          type="button"
          onClick={() => router.reload()}
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
