import { useOnScreen } from "@block-feed/hooks/use-on-screen.hook"
import { useEffect, useReducer } from "react"

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
  formatter?: (num: number) => string

  /*
   * A function that controls the animation speed
   */
  getIncrDelayMs: (
    ctx: Readonly<{
      start: number
      final: number
      state: CounterState
    }>,
  ) => number
}>

export function Counter(props: CounterProps) {
  const { ref, isVisible } = useOnScreen<HTMLSpanElement>()

  const [state, setState] = useReducer(
    (currState: CounterState, nextState: CounterState) => {
      return {
        ...currState,
        ...nextState,
      }
    },
    {
      num: props.start,
    },
  )

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
        props.getIncrDelayMs({
          ...props,
          state,
        }),
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
      {props.formatter != null ? props.formatter(state.num) : state.num}
    </span>
  )
}
