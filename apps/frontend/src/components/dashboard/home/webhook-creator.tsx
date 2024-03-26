import { WebhookCreateForm } from "@block-feed/components/dashboard/home/forms/webhook-create.form"
import { Modal } from "@block-feed/components/shared/modal"
import * as client from "@block-feed/client"
import { useState } from "react"

export type WebhookCreatorProps = Readonly<{
  blockchains: string[]
  afterCreate: () => void
}>

export function WebhookCreator(props: WebhookCreatorProps) {
  const [isCreateModalVisible, setCreateModalVisibility] = useState(false)
  const webhookCreator = client.useGraphQLMutation(
    client.graphql(
      "mutation CreateWebhook($data: WebhookCreateInput!) {\n  webhookCreate(data: $data) {\n    id\n  }\n}",
    ),
  )

  return (
    <>
      <Modal
        className="flex w-1/4 flex-col items-center justify-center gap-y-5 rounded-lg border border-white border-opacity-50 bg-dashboard p-5 text-white"
        open={isCreateModalVisible}
        onClose={() => setCreateModalVisibility(false)}
      >
        <span className="text-center text-xl">Create a Webhook</span>
        <WebhookCreateForm
          blockchains={props.blockchains}
          disabled={webhookCreator.isPending}
          onSubmit={(data) => {
            webhookCreator
              .mutateAsync({
                data: {
                  url: data.url,
                  maxBlocks: data.maxBlocks,
                  maxRetries: data.maxRetries,
                  timeoutMs: data.timeoutMs,
                  blockchainId: data.blockchainId,
                },
              })
              .then(() => {
                setCreateModalVisibility(false)
                props.afterCreate()
              })
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
          className="rounded-lg border border-sky-blue p-3 transition-all ease-linear hover:opacity-50"
          type="button"
          onClick={() => setCreateModalVisibility(true)}
        >
          + Create Webhook
        </button>
      </div>
    </>
  )
}
