import { UserProfile } from "@auth0/nextjs-auth0/client"
import { getSession } from "@auth0/nextjs-auth0"
import { FaUserCircle } from "react-icons/fa"
import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

export async function Header() {
  const user = await getSession().then((sess) => {
    if (sess == null) {
      redirect("/api/auth/login")
    }
    return sess.user as UserProfile
  })

  return (
    <div className="w-full border-b border-b-white border-opacity-30 bg-dashboard p-3">
      <div className="flex flex-row items-center justify-between">
        <h1 className="ml-2 text-xl font-bold text-white">Dashboard</h1>
        <Link href="/profile">
          {user.picture != null ? (
            <Image
              className="mr-2 rounded-full"
              src={user.picture}
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
