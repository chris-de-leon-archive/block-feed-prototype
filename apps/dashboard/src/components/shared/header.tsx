import { UserButton } from "@clerk/nextjs"

// TODO: allow users to delete their accounts - this should also remove
// their stripe subscription and any database data associated with their
// account
export function Header() {
  return (
    <div className="w-full border-b border-b-white border-opacity-30 bg-dashboard p-3">
      <div className="flex flex-row items-center justify-between">
        <h1 className="ml-2 text-xl font-bold text-white">Dashboard</h1>
        <UserButton />
      </div>
    </div>
  )
}
