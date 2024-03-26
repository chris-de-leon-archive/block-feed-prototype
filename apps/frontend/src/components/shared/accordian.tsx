import { IoIosArrowUp } from "react-icons/io"
import { useRef, useState } from "react"

export type AccordianProps = Readonly<{
  title: string
  content: string
}>

export function Accordian(props: AccordianProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="flex flex-col rounded-xl border border-sky-blue text-white">
      <button
        className="w-full p-5 text-left"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="flex w-full flex-row items-center justify-between">
          <p className="text-2xl">{props.title}</p>
          <div
            className={"transition-all duration-[450ms] ease-in-out".concat(
              isOpen ? " -rotate-180" : "",
            )}
          >
            <IoIosArrowUp />
          </div>
        </div>
      </button>
      <div
        className="overflow-hidden rounded-xl transition-[height] duration-[450ms] ease-in-out"
        style={{ height: isOpen ? ref.current?.scrollHeight : "0px" }}
        ref={ref}
      >
        <p className="m-5">{props.content}</p>
      </div>
    </div>
  )
}
