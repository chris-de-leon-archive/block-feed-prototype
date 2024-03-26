import { useRouter } from "next/router"
// import { useState } from "react"
import Link from "next/link"

// TODO:
export function TableOfContents() {
  // const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false)
  const router = useRouter()

  return (
    <div className="text-white">
      {/* Desktop */}
      <div className="hidden bg-landing px-12 md:flex">
        <ul className="flex flex-col whitespace-nowrap">
          {items.map((item, i) => {
            return (
              <li className="mb-3" key={i}>
                {router.route === item.route ? (
                  <Link
                    className="text-blue-glow text-sky-blue"
                    href={item.route}
                  >
                    {item.name}
                  </Link>
                ) : (
                  <Link className="hover-text-blue-glow" href={item.route}>
                    {item.name}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Mobile */}
    </div>
  )
}

const items = [
  {
    route: "/docs",
    name: "Overview",
  },
  {
    route: "/docs/get-started",
    name: "Get Started",
  },
  {
    route: "/docs/usage",
    name: "Usage",
  },
  {
    route: "/docs/supported-chains",
    name: "Supported Chains",
  },
  {
    route: "/docs/architecture",
    name: "Architecture",
  },
]
