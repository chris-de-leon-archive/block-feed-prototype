import { PropsWithChildren } from "react"

export type ModalProps = PropsWithChildren &
  Readonly<{
    className?: string
    open: boolean
    onClose: () => void
  }>

export function Modal(props: ModalProps) {
  return (
    <div
      className={"fixed inset-0 z-[2] flex items-center justify-center bg-black bg-opacity-50".concat(
        props.open ? "" : " hidden",
      )}
      onClick={props.onClose}
    >
      <div className={props.className} onClick={(e) => e.stopPropagation()}>
        {props.children}
      </div>
    </div>
  )
}
