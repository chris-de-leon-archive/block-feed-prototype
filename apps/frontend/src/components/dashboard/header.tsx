import { DashboardLayoutContext } from "@block-feed/layouts/dashboard.layout"
import { FaUserCircle } from "react-icons/fa"
import Image from "next/image"
import Link from "next/link"

export function Header(props: DashboardLayoutContext) {
  return (
    <div className="w-full border-b border-b-white border-opacity-30 bg-dashboard p-3">
      <div className="flex flex-row items-center justify-between">
        <h1 className="ml-2 text-xl font-bold text-white">Dashboard</h1>
        <Link href="/dashboard/profile">
          {props.user.picture != null ? (
            <Image
              className="mr-2 rounded-full"
              src={props.user.picture}
              alt="user-profile-picture"
              width={36}
              height={36}
            />
          ) : (
            <div className="mr-2 text-3xl text-white">
              <FaUserCircle />
            </div>
          )}
        </Link>
      </div>
    </div>
  )
}
