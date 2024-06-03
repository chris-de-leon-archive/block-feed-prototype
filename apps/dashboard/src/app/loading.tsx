export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full flex-row items-center justify-center gap-x-5 text-white">
      <div className="border-sky-blue h-10 w-10 animate-spin rounded-full border-2 border-t-white" />
      <span className="text-5xl">Loading...</span>
    </div>
  )
}
