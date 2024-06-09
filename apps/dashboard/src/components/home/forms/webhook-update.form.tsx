"use client"

import { constants } from "@block-feed/shared"
import { useState } from "react"
import { z } from "zod"

export type WebhookEditFormProps = Readonly<{
  webhook: Required<z.infer<typeof zFormParser>> | null
  disabled: boolean
  onSubmit: (data: z.infer<typeof zFormParser>) => void
  onParseError: (err: z.ZodError<z.infer<typeof zFormParser>>) => void
}>

type FormState = Partial<Record<keyof z.infer<typeof zFormParser>, string>>

const zFormParser = z.object({
  id: z.string().uuid(),
  url: z.string().url().optional(),
  maxRetries: z.coerce.number().int().optional(),
  maxBlocks: z.coerce.number().int().optional(),
  timeoutMs: z.coerce.number().int().optional(),
})

export function WebhookEditForm(props: WebhookEditFormProps) {
  const [form, setForm] = useState<FormState>({})

  const webhook = props.webhook
  if (webhook == null) {
    return <></>
  }

  return (
    <form
      className="flex w-full flex-col gap-y-2 rounded-lg border border-white border-opacity-50 p-5"
      onSubmit={(e) => {
        e.preventDefault()

        const result = zFormParser.safeParse({ id: webhook.id, ...form })
        if (!result.success) {
          setForm({})
          props.onParseError(result.error)
        } else {
          setForm({})
          props.onSubmit(result.data)
        }
      }}
    >
      <label className="flex flex-col gap-y-2">
        <input
          className="focus:border-sky-blue border-b bg-transparent py-3 text-xs text-white outline-none transition-all placeholder:text-white placeholder:opacity-50"
          placeholder={webhook.url.toString()}
          value={form.url ?? webhook.url}
          type="url"
          minLength={constants.webhooks.limits.URL_LEN.MIN}
          maxLength={constants.webhooks.limits.URL_LEN.MAX}
          onChange={(e) => setForm({ ...form, url: e.currentTarget.value })}
        />
        <span className="text-sm opacity-50">Webhook URL</span>
      </label>
      <label className="flex flex-col gap-y-2">
        <input
          className="focus:border-sky-blue border-b bg-transparent py-3 text-xs text-white outline-none transition-all placeholder:text-white placeholder:opacity-50"
          placeholder={webhook.maxBlocks.toString()}
          value={form.maxBlocks ?? webhook.maxBlocks}
          type="number"
          min={constants.webhooks.limits.MAX_BLOCKS.MIN}
          max={constants.webhooks.limits.MAX_BLOCKS.MAX}
          onChange={(e) =>
            setForm({ ...form, maxBlocks: e.currentTarget.value })
          }
        />
        <span className="text-sm opacity-50">Max Blocks</span>
      </label>
      <label className="flex flex-col gap-y-2">
        <input
          className="focus:border-sky-blue border-b bg-transparent py-3 text-xs text-white outline-none transition-all placeholder:text-white placeholder:opacity-50"
          placeholder={webhook.maxRetries.toString()}
          value={form.maxRetries ?? webhook.maxRetries}
          type="number"
          min={constants.webhooks.limits.MAX_RETRIES.MIN}
          max={constants.webhooks.limits.MAX_RETRIES.MAX}
          onChange={(e) =>
            setForm({ ...form, maxRetries: e.currentTarget.value })
          }
        />
        <span className="text-sm opacity-50">Max Retries</span>
      </label>
      <label className="flex flex-col gap-y-2">
        <input
          className="focus:border-sky-blue border-b bg-transparent py-3 text-xs text-white outline-none transition-all placeholder:text-white placeholder:opacity-50"
          placeholder={webhook.timeoutMs.toString()}
          value={form.timeoutMs ?? webhook.timeoutMs}
          type="number"
          min={constants.webhooks.limits.TIMEOUT_MS.MIN}
          max={constants.webhooks.limits.TIMEOUT_MS.MAX}
          onChange={(e) =>
            setForm({ ...form, timeoutMs: e.currentTarget.value })
          }
        />
        <span className="text-sm opacity-50">HTTP Timeout (ms)</span>
      </label>
      <button
        className={"border-sky-blue mt-3 flex w-full flex-col items-center rounded-lg border p-3"
          .concat(" ")
          .concat(
            props.disabled
              ? "opacity-50"
              : "transition-all ease-linear hover:opacity-50",
          )}
        disabled={props.disabled}
        type="submit"
      >
        {props.disabled ? (
          <div className="flex flex-row items-center gap-x-2">
            <div className="border-sky-blue h-5 w-5 animate-spin rounded-full border-2 border-t-white" />
            <span>Loading...</span>
          </div>
        ) : (
          <>Submit</>
        )}
      </button>
    </form>
  )
}
