import { FaLinkedin, FaDiscord, FaGithub } from "react-icons/fa6"
import Image from "next/image"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-landing text-white">
      <div className="container mx-auto border-t border-t-white border-opacity-10">
        <div className="flex flex-row flex-wrap justify-between gap-y-12 py-12">
          <div className="flex flex-col items-start gap-y-5">
            <div className="relative h-[30px] w-[125px]">
              <Image src="/logos/simple.svg" alt="logo-simple" fill />
            </div>
            <span>Blockchain Data Delivery Made Simple!</span>
            <div className="flex flex-row flex-wrap items-center gap-x-5 gap-y-5">
              <Link
                className="text-2xl"
                href="https://www.linkedin.com/company/block-feed"
                target="_blank"
              >
                <FaLinkedin />
              </Link>
              <Link
                className="text-2xl"
                href="https://github.com/chris-de-leon/block-feed-prototype"
                target="_blank"
              >
                <FaGithub />
              </Link>
              <Link
                className="text-2xl"
                href="https://discord.gg/KP6wpWgFwm"
                target="_blank"
              >
                <FaDiscord />
              </Link>
            </div>
            <div>
              <p className="text-sm">
                Copyright ⓒ 2024 Chris De Leon, trading as LedgerWeave. All
                Rights Reserved.
              </p>
            </div>
          </div>
          <div className="flex flex-row flex-wrap gap-x-9 gap-y-9">
            <div className="flex flex-col">
              <span className="font-bold">Product</span>
              <ul className="list-none">
                <li className="my-2 opacity-50">
                  <Link href={"/"}>Home</Link>
                </li>
                <li className="my-2 opacity-50">
                  <Link href={"/about"}>About Us</Link>
                </li>
                <li className="my-2 opacity-50">
                  <Link
                    href={"https://www.linkedin.com/company/block-feed"}
                    target="_blank"
                  >
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
            <div className="flex flex-col">
              <span className="font-bold">Resources</span>
              <ul className="list-none">
                <li className="my-2 opacity-50">
                  <Link href={"/privacy-policy"}>Privacy Policy</Link>
                </li>
                <li className="my-2 opacity-50">
                  <Link href={"/docs"}>Documentation</Link>
                </li>
                <li className="my-2 opacity-50">
                  <Link href={"/contact"}>Contact Us</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
