"use client"

import { useOnScreen } from "@block-feed/web/hooks/use-on-screen.hook"
import { useEffect, useState } from "react"

type CounterState = Readonly<{
  num: number
}>

export type CounterProps = Readonly<{
  /*
   * Additional tailwind styling
   */
  className?: string

  /*
   * The number to start counting from
   */
  start: number

  /*
   * The number to count up to (assumed to be greater than the starting number)
   */
  final: number

  /*
   * Applies additional formatting to the current number
   */
  suffix: string

  /*
   * After the counter is incremented, we will wait Math.pow(speedConstant, currentNumber) milliseconds
   */
  speedConstant: number
}>

export function Counter(props: CounterProps) {
  const { ref, isVisible } = useOnScreen<HTMLSpanElement>()
  const [state, setState] = useState<CounterState>({
    num: props.start,
  })

  useEffect(() => {
    // If the counter is visible, run the animation
    if (isVisible) {
      if (state.num >= props.final) {
        return
      }

      const timeout = setTimeout(
        () => {
          setState({
            num: state.num + 1,
          })
        },
        // Gradually slow down the animation as we get to the final number
        Math.pow(props.speedConstant, state.num),
      )

      return () => clearTimeout(timeout)
    }

    // If the counter is not visible and we've finished counting,
    // then restart the counter from the beginning
    if (state.num >= props.final) {
      setState({ num: props.start })
    }

    // If the counter is not visible, pause the animation
    return
  }, [state, props, isVisible])

  return (
    <span className={props.className} ref={ref}>
      {state.num.toString().concat(props.suffix)}
    </span>
  )
}
