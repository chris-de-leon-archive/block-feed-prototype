"use client"

import { WebhookCreateForm } from "@block-feed/dashboard/components/home/forms/webhook-create.form"
import { Modal } from "@block-feed/dashboard/components/shared/modal"
import { useAuth } from "@clerk/nextjs"
import { useState } from "react"
import {
  useGraphQLDashboardMutation,
  CreateWebhookDocument,
} from "@block-feed/dashboard/client"

export type WebhookCreatorProps = Readonly<{
  blockchains: string[]
  afterCreate: () => void
}>

export function WebhookCreator(props: WebhookCreatorProps) {
  const [isCreateModalVisible, setCreateModalVisibility] = useState(false)
  const { getToken } = useAuth()

  const webhookCreator = useGraphQLDashboardMutation(
    CreateWebhookDocument,
    getToken,
  )

  return (
    <>
      <Modal
        className="bg-dashboard flex w-1/4 flex-col items-center justify-center gap-y-5 rounded-lg border border-white border-opacity-50 p-5 text-white"
        open={isCreateModalVisible}
        onClose={() => setCreateModalVisibility(false)}
      >
        <span className="text-center text-xl">Create a Webhook</span>
        <WebhookCreateForm
          blockchains={props.blockchains}
          disabled={webhookCreator.isPending}
          onSubmit={(data) => {
            webhookCreator.mutate(
              {
                data: {
                  url: data.url,
                  maxBlocks: data.maxBlocks,
                  maxRetries: data.maxRetries,
                  timeoutMs: data.timeoutMs,
                  blockchainId: data.blockchainId,
                },
              },
              {
                onSettled: () => {
                  setCreateModalVisibility(false)
                  props.afterCreate()
                },
              },
            )
          }}
          onParseError={(err) => {
            console.error(err)
            setCreateModalVisibility(false)
          }}
        />
      </Modal>
      <div className="flex w-full flex-row items-center justify-between">
        <h2 className="text-2xl font-bold">Webhooks</h2>
        <button
          className="border-sky-blue rounded-lg border p-3 transition-all ease-linear hover:opacity-50"
          type="button"
          onClick={() => setCreateModalVisibility(true)}
        >
          + Create Webhook
        </button>
      </div>
    </>
  )
}
