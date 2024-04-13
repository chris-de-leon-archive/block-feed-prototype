import { UserProfile } from "@auth0/nextjs-auth0/client"
import { getSession } from "@auth0/nextjs-auth0"
import { FaUserCircle } from "react-icons/fa"
import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

export default async function Profile() {
  const user = await getSession().then((sess) => {
    if (sess == null) {
      redirect("/api/auth/login")
    }
    return sess.user as UserProfile
  })

  return (
    <div className="container mx-auto mt-24">
      <div className="flex flex-col gap-y-12">
        <h2 className="text-3xl text-white">Your Profile</h2>
        <div className="flex flex-row items-center gap-x-16 rounded-lg border border-white border-opacity-50 p-10">
          <div className="flex flex-col items-center gap-y-5">
            {user.picture != null ? (
              <Image
                className="mr-2 rounded-full"
                src={user.picture}
                alt="user-profile-picture"
                width={96}
                height={96}
                priority
              />
            ) : (
              <div className="mr-2 text-3xl text-white">
                <FaUserCircle />
              </div>
            )}
            <Link
              className="rounded-lg border border-white border-opacity-50 p-2 text-center text-white transition-all ease-linear hover:border-opacity-100"
              href="/api/auth/logout"
            >
              Logout
            </Link>
          </div>
          <div className="flex flex-col gap-y-3 text-white">
            <div className="flex flex-col">
              <span className="opacity-50">Name</span>
              <span>{user.name ?? "-"}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-50">Nickname</span>
              <span>{user.nickname ?? "-"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-y-3 text-white">
            <div className="flex flex-col">
              <span className="opacity-50">Email</span>
              <span>{user.email ?? "-"}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-50">Email Verified</span>
              <span>
                {user.email_verified == null
                  ? "-"
                  : String(user.email_verified)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-y-3 text-white">
            <div className="flex flex-col">
              <span className="opacity-50">User ID</span>
              <span>{user.sub ?? "-"}</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-50">Updated At</span>
              <span>{user.updated_at ?? "-"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
