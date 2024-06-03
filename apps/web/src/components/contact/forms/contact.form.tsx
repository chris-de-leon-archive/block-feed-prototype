"use client"

import { useState } from "react"
import { z } from "zod"

export type ContactFormProps = Readonly<{
  onParseError: (err: z.ZodError<z.infer<typeof zFormParser>>) => void
  onError: (err: Error) => void
  onSuccess: () => void
}>

type FormState = Partial<Record<keyof z.infer<typeof zFormParser>, string>> & {
  isLoading: boolean
}

const zFormParser = z.object({
  name: z.string(),
  email: z.string().email(),
  message: z.string(),
})

export function ContactForm(props: ContactFormProps) {
  const [state, setState] = useState<FormState>({
    isLoading: false,
  })

  return (
    <form
      className="flex flex-col gap-y-2 rounded-lg border border-sky-blue p-5 shadow-lg shadow-sky-blue"
      onSubmit={(e) => {
        setState({ isLoading: true })
        e.preventDefault()

        const url = new URL("https://api.staticforms.xyz/submit")
        const key = "b30bbc32-c78a-4ed7-bcfd-9afc24984b09"
        const sub = "Contact Request - blockfeed.io"
        const res = zFormParser.safeParse(state)
        if (!res.success) {
          props.onParseError(res.error)
          return
        }

        fetch(url.href, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessKey: key,
            subject: sub,
            name: res.data.name,
            email: res.data.email,
            message: res.data.message,
          }),
        })
          .then(() => {
            setState({ isLoading: false })
            props.onSuccess()
          })
          .catch((err) => {
            setState({ isLoading: false })
            if (err instanceof Error) {
              props.onError(err)
            } else {
              props.onError(new Error(String(err)))
            }
          })
      }}
    >
      {/* This is for spam protection */}
      <input type="text" name="honeypot" className="hidden" />

      {/* The visible form field(s) are below */}
      <label className="flex flex-col gap-y-2">
        <input
          className="border-b border-b-sky-blue border-opacity-50 bg-transparent py-3 text-xs outline-none transition-all ease-linear focus:border-opacity-100"
          autoComplete="given-name"
          value={state.name ?? ""}
          name="name"
          type="text"
          required
          minLength={1}
          maxLength={128}
          onChange={(e) => setState({ ...state, name: e.currentTarget.value })}
        />
        <div className="flex flex-row text-sm">
          <span>Full Name</span>
          <span className="text-red-700">*</span>
        </div>
      </label>
      <label className="flex flex-col gap-y-2">
        <input
          className="border-b border-b-sky-blue border-opacity-50 bg-transparent py-3 text-xs outline-none transition-all ease-linear focus:border-opacity-100"
          autoComplete="email"
          value={state.email ?? ""}
          name="email"
          type="email"
          required
          onChange={(e) => setState({ ...state, email: e.currentTarget.value })}
        />
        <div className="flex flex-row text-sm">
          <span>Email</span>
          <span className="text-red-700">*</span>
        </div>
      </label>
      <label className="flex flex-col gap-y-2">
        <textarea
          className="border-b border-b-sky-blue border-opacity-50 bg-transparent py-3 text-xs outline-none transition-all ease-linear focus:border-opacity-100"
          name="message"
          required
          value={state.message ?? ""}
          onChange={(e) =>
            setState({ ...state, message: e.currentTarget.value })
          }
        />
        <div className="flex flex-row text-sm">
          <span>Message</span>
          <span className="text-red-700">*</span>
        </div>
      </label>
      <button
        className={"button-base mt-5 flex w-full flex-col items-center border-2 border-sky-blue border-opacity-50".concat(
          state.isLoading
            ? ""
            : "transition-all ease-linear hover:border-opacity-100",
        )}
        disabled={state.isLoading}
        type="submit"
      >
        {state.isLoading ? (
          <div className="flex flex-row items-center gap-x-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-blue border-t-white border-opacity-50" />
            Loading...
          </div>
        ) : (
          <>Submit</>
        )}
      </button>
    </form>
  )
}
