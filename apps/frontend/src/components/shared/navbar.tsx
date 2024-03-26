import { useState } from "react"
import Image from "next/image"
import Link from "next/link"

export function Navbar() {
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false)

  return (
    <nav className="bg-landing text-white">
      <div className="container mx-auto border-b border-b-white border-opacity-10 py-4">
        {/* Desktop */}
        <div className="hidden w-full flex-row items-center justify-between md:flex">
          <div className="flex flex-row items-center justify-around md:gap-x-3">
            <Link
              className="mr-2 flex flex-row items-center gap-x-1"
              href={"/"}
            >
              <Image
                src={"/logos/box.svg"}
                alt="logo-simple"
                width={30}
                height={30}
              />
              <h1 className="text-xl font-bold">Block Feed</h1>
            </Link>
            <Link className="hover-text-blue-glow" href={"/docs"}>
              Documentation
            </Link>
            <Link className="hover-text-blue-glow" href={"/pricing"}>
              Pricing
            </Link>
            <Link className="hover-text-blue-glow" href={"/about"}>
              About
            </Link>
            <Link className="hover-text-blue-glow" href={"/contact"}>
              Contact
            </Link>
          </div>
          <div className="flex flex-row items-center md:gap-x-3">
            <Link className="hover-text-blue-glow" href={"/dashboard"}>
              Login
            </Link>
            <Link className="button-blue-glow max-w-fit" href={"/dashboard"}>
              Sign Up
            </Link>
          </div>
        </div>

        {/* Mobile */}
        <div className="flex w-full flex-row items-center justify-between md:hidden">
          {isHamburgerMenuOpen && (
            <div
              className="fixed inset-0 z-[2] bg-black bg-opacity-90"
              onClick={() => setIsHamburgerMenuOpen(false)}
            >
              <div className="flex w-full items-end justify-end">
                <button
                  className="rounded px-3 py-3"
                  onClick={() => setIsHamburgerMenuOpen(false)}
                  type="button"
                >
                  <svg
                    className="h-3 w-3 fill-current"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" />
                  </svg>
                </button>
              </div>
              <div className="flex h-full flex-col items-center justify-evenly">
                <Link
                  className="w-5/6 rounded border border-sky-blue p-2 text-center shadow-md shadow-sky-blue"
                  href={"/"}
                >
                  Home
                </Link>
                <Link
                  className="w-5/6 rounded border border-sky-blue p-2 text-center shadow-md shadow-sky-blue"
                  href={"/docs"}
                >
                  Documentation
                </Link>
                <Link
                  className="w-5/6 rounded border border-sky-blue p-2 text-center shadow-md shadow-sky-blue"
                  href={"/pricing"}
                >
                  Pricing
                </Link>
                <Link
                  className="w-5/6 rounded border border-sky-blue p-2 text-center shadow-md shadow-sky-blue"
                  href={"/about"}
                >
                  About
                </Link>
                <Link
                  className="w-5/6 rounded border border-sky-blue p-2 text-center shadow-md shadow-sky-blue"
                  href={"/contact"}
                >
                  Contact
                </Link>
                <div className="flex w-full flex-row items-center justify-around">
                  <Link
                    className="w-1/3 rounded border border-sky-blue p-2 text-center shadow-md shadow-sky-blue"
                    href={"/dashboard"}
                  >
                    Login
                  </Link>
                  <Link
                    className="w-1/3 rounded border border-sky-blue p-2 text-center shadow-md shadow-sky-blue"
                    href={"/dashboard"}
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            </div>
          )}
          <Link className="mr-2 flex flex-row items-center gap-x-1" href={"/"}>
            <Image
              src={"/logos/box.svg"}
              alt="logo-simple"
              width={25}
              height={25}
            />
            <h1 className="text-lg font-bold">Block Feed</h1>
          </Link>
          <button
            className="text-black-500 hover:text-black-400 flex items-center rounded px-3 py-2"
            onClick={() => setIsHamburgerMenuOpen(true)}
            type="button"
          >
            <svg
              className="h-3 w-3 fill-current"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}
