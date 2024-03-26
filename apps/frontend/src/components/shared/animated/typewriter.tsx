import { useEffect, useReducer } from "react"

type TypeWriterState = Readonly<{
  wordIdx: number // helps keep track of which word we need to type out next
  word: string // stores the partially typed word
}>

export type TypeWriterProps = Readonly<{
  className?: string
  typingDelayMs: number
  typingPauseMs: number
  words: string[]
}>

export function TypeWriter(props: TypeWriterProps) {
  const [state, setState] = useReducer(
    (currState: TypeWriterState, nextState: TypeWriterState) => {
      return {
        ...currState,
        ...nextState,
      }
    },
    {
      wordIdx: 0,
      word: "",
    },
  )

  useEffect(() => {
    // Defines helper vars
    const fullyTypedWord = props.words[state.wordIdx]
    const partiallyTypedWord = state.word

    // Return back to the first word if we typed all of them out
    if (state.wordIdx >= props.words.length) {
      setState({
        wordIdx: 0,
        word: "",
      })
      return
    }

    // Repeatedly add characters until the current word has been fully typed out
    //
    // Note that timeouts need to be handled a particular way:
    //
    //  https://stackoverflow.com/questions/53090432/react-hooks-right-way-to-clear-timeouts-and-intervals
    //
    if (partiallyTypedWord.length < fullyTypedWord.length) {
      const nextChar = fullyTypedWord[partiallyTypedWord.length]
      const timeout = setTimeout(() => {
        setState({
          word: partiallyTypedWord.concat(nextChar),
          wordIdx: state.wordIdx,
        })
      }, props.typingDelayMs)
      return () => clearTimeout(timeout)
    }

    // Move onto the next word if the current word has been typed out
    const timeout = setTimeout(() => {
      setState({
        word: "",
        wordIdx: state.wordIdx + 1,
      })
    }, props.typingPauseMs)
    return () => clearTimeout(timeout)
  }, [state, props])

  // Returns the partially typed word
  return (
    <span className={props.className}>
      {state.word === "" ? "_" : state.word.concat("_")}
    </span>
  )
}
