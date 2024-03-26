import { WebhookStatus } from "@block-feed/shared/enums/webhook-status.enum"
import { useState } from "react"
import { z } from "zod"

export type WebhookSearchFormProps = Readonly<{
  blockchains: string[]
  disabled: boolean
  onSubmit: (data: z.infer<typeof zFormParser>) => void
  onParseError: (err: z.ZodError<z.infer<typeof zFormParser>>) => void
}>

type FormState = Partial<Record<keyof z.infer<typeof zFormParser>, string>>

const zFormParser = z.object({
  blockchain: z.string().optional(),
  status: z.string().optional(),
  url: z.string().optional(),
})

export function WebhookSearchForm(props: WebhookSearchFormProps) {
  const [form, setForm] = useState<FormState>({})

  return (
    <form
      className="flex w-full flex-col gap-y-5 rounded-lg border border-white border-opacity-30 p-5"
      onSubmit={(e) => {
        e.preventDefault()

        const result = zFormParser.safeParse(form)
        if (!result.success) {
          props.onParseError(result.error)
        } else {
          props.onSubmit(result.data)
        }
      }}
    >
      <h2 className="text-2xl font-bold">Filters</h2>
      <div className="flex w-full flex-row items-center justify-between gap-x-5">
        <label className="flex w-1/4 flex-col gap-y-2">
          <span className="text-md">What URL are you looking for?</span>
          <input
            className="w-full border-b bg-transparent py-3 text-xs outline-none transition-all focus:border-sky-blue"
            value={form.url ?? ""}
            type="text"
            onChange={(e) => setForm({ ...form, url: e.currentTarget.value })}
          />
        </label>
        <label className="flex w-1/4 flex-col gap-y-2">
          <span className="text-md">Status</span>
          <select
            className="w-full border-b bg-transparent py-3 text-xs outline-none transition-all focus:border-sky-blue"
            value={form.status ?? ""}
            onChange={(e) =>
              setForm({ ...form, status: e.currentTarget.value })
            }
          >
            <option></option>
            {Object.values(WebhookStatus).map((status, i) => (
              <option className="text-black" key={i}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-1/4 flex-col gap-y-2">
          <span className="text-md">Blockchain</span>
          <select
            className="w-full border-b bg-transparent py-3 text-xs outline-none transition-all focus:border-sky-blue"
            value={form.blockchain ?? ""}
            onChange={(e) =>
              setForm({ ...form, blockchain: e.currentTarget.value })
            }
          >
            <option></option>
            {props.blockchains.map((blockchain, i) => (
              <option className="text-black" key={i}>
                {blockchain}
              </option>
            ))}
          </select>
        </label>
        <button
          className={"mt-3 flex w-1/4 flex-col items-center rounded-lg border border-sky-blue p-3".concat(
            props.disabled
              ? " opacity-50"
              : " transition-all ease-linear hover:opacity-50",
          )}
          disabled={props.disabled}
          type="submit"
        >
          Search
        </button>
      </div>
    </form>
  )
}
