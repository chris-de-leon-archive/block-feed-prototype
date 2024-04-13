import { useEffect, useRef, useState } from "react"

export function useOnScreen<T extends Element>() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry != null) {
        setIsVisible(entry.isIntersecting)
      }
    })

    if (ref.current != null) {
      observer.observe(ref.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  return { ref, isVisible }
}
