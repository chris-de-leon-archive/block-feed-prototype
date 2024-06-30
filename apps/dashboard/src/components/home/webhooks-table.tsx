"use client"

import { FaArrowCircleLeft, FaArrowCircleRight } from "react-icons/fa"
import { Modal } from "@block-feed/dashboard/components/shared/modal"
import { MdDeleteForever } from "react-icons/md"
import { IoRefresh } from "react-icons/io5"
import { useEffect, useState } from "react"
import { GrDeploy } from "react-icons/gr"
import { FaEdit } from "react-icons/fa"
import { useAuth } from "@clerk/nextjs"
import {
  WebhookEditFormProps,
  WebhookEditForm,
} from "@block-feed/dashboard/components/home/forms/webhook-update.form"
import {
  formatWebhookStatus,
  formatUTCDateStr,
} from "@block-feed/dashboard/utils/fmt"
import {
  useGraphQLDashboardMutation,
  ActivateWebhooksDocument,
  RemoveWebhooksDocument,
  UpdateWebhookDocument,
  WebhooksQuery,
} from "@block-feed/dashboard/client"

type WebhookToEdit = WebhookEditFormProps["webhook"] | null

type WebhookCheckboxState = Map<
  string,
  Readonly<{
    webhook: WebhooksQuery["webhooks"]["payload"][number]
    isChecked: boolean
  }>
>

export type WebhooksTableProps = Readonly<{
  webhooks: WebhooksQuery["webhooks"]["payload"]
  isFetching: boolean
  isFetchingNextPage: boolean
  isFetchingPrevPage: boolean
  hasNextPage: boolean
  hasPrevPage: boolean
  afterActivate: () => void
  afterRemove: () => void
  afterEdit: () => void
  onRefresh: () => void
  onNextPage: () => void
  onPrevPage: () => void
}>

export function WebhooksTable(props: WebhooksTableProps) {
  // Component state
  const [webhookToEdit, setWebhookToEdit] = useState<WebhookToEdit>(null)
  const [selected, setSelected] = useState<WebhookCheckboxState>(new Map())
  const { getToken } = useAuth()

  // If a new list of webhooks is available, reset the checkbox state
  useEffect(() => {
    setSelected(
      new Map(
        props.webhooks.map((w) => [w.id, { webhook: w, isChecked: false }]),
      ),
    )
  }, [props.webhooks])

  // Gets mutations for webhooks
  const webhookActivator = useGraphQLDashboardMutation(
    ActivateWebhooksDocument,
    getToken,
  )
  const webhookRemover = useGraphQLDashboardMutation(
    RemoveWebhooksDocument,
    getToken,
  )
  const webhookEditor = useGraphQLDashboardMutation(
    UpdateWebhookDocument,
    getToken,
  )

  // Checkbox helper functions
  const checkboxes = {
    isEverythingChecked: () => {
      const count = Array.from(selected.values()).filter(
        (v) => v.isChecked,
      ).length
      return selected.size !== 0 && count === selected.size
    },
    checkAll: (checked: boolean) => {
      return new Map(
        Array.from(selected.entries()).map(([k, v]) => [
          k,
          {
            webhook: v.webhook,
            isChecked: checked,
          },
        ]),
      )
    },
    checkOne: (key: string, checked: boolean) => {
      return new Map(
        Array.from(selected.entries()).map(([k, v]) => {
          return k === key
            ? [
                k,
                {
                  webhook: v.webhook,
                  isChecked: checked,
                },
              ]
            : [k, v]
        }),
      )
    },
    getCheckedWebhookIDs: () => {
      return Array.from(selected.values())
        .filter((v) => v.isChecked)
        .map((v) => v.webhook.id)
    },
    canActivate: () => {
      const checked = Array.from(selected.values()).filter((v) => v.isChecked)
      const inactive = checked.filter((v) => v.webhook.isActive === 0)
      return (
        !props.isFetching &&
        !webhookActivator.isPending &&
        checked.length > 0 &&
        inactive.length === checked.length
      )
    },
    canDelete: () => {
      return (
        !props.isFetching &&
        !webhookRemover.isPending &&
        Array.from(selected.values()).filter((v) => v.isChecked).length > 0
      )
    },
  }

  return (
    <>
      <Modal
        className="bg-dashboard flex w-1/4 flex-col items-center justify-center gap-y-5 rounded-lg border border-white border-opacity-50 p-5 text-white"
        open={webhookToEdit != null}
        onClose={() => setWebhookToEdit(null)}
      >
        <span className="text-xl">Edit a Webhook</span>
        <WebhookEditForm
          webhook={webhookToEdit}
          disabled={webhookEditor.isPending}
          onSubmit={(data) => {
            webhookEditor.mutate(
              {
                id: data.id,
                data: {
                  url: data.url,
                  maxBlocks: data.maxBlocks,
                  maxRetries: data.maxRetries,
                  timeoutMs: data.timeoutMs,
                },
              },
              {
                onSettled: () => {
                  setWebhookToEdit(null)
                  props.afterEdit()
                },
              },
            )
          }}
          onParseError={(err) => {
            setWebhookToEdit(null)
            console.error(err)
          }}
        />
      </Modal>
      <div className="flex w-full flex-col gap-y-5 rounded-lg border border-white border-opacity-30">
        {/* Action Menu Container */}
        <div className="flex flex-row items-center justify-between p-5">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold">Results</h2>
          </div>
          <div className="flex flex-row items-center gap-x-5">
            <button
              className={"border-sky-blue rounded-lg border p-3"
                .concat(" ")
                .concat(
                  props.isFetching ||
                    props.isFetchingPrevPage ||
                    !props.hasPrevPage
                    ? "opacity-50"
                    : "transition-all ease-linear hover:opacity-50",
                )}
              type="button"
              disabled={
                props.isFetching ||
                props.isFetchingPrevPage ||
                !props.hasPrevPage
              }
              onClick={() => {
                props.onPrevPage()
              }}
            >
              {props.isFetchingPrevPage ? (
                <div className="flex flex-row items-center gap-x-2">
                  <div className="border-sky-blue h-5 w-5 animate-spin rounded-full border-2 border-t-white" />
                  <span>Loading...</span>
                </div>
              ) : (
                <div className="flex flex-row items-center justify-center gap-x-1">
                  <FaArrowCircleLeft />
                  <span>Previous</span>
                </div>
              )}
            </button>
            <button
              className={"border-sky-blue rounded-lg border p-3"
                .concat(" ")
                .concat(
                  props.isFetching ||
                    props.isFetchingNextPage ||
                    !props.hasNextPage
                    ? "opacity-50"
                    : "transition-all ease-linear hover:opacity-50",
                )}
              type="button"
              disabled={
                props.isFetching ||
                props.isFetchingNextPage ||
                !props.hasNextPage
              }
              onClick={() => {
                props.onNextPage()
              }}
            >
              {props.isFetchingNextPage ? (
                <div className="flex flex-row items-center gap-x-2">
                  <div className="border-sky-blue h-5 w-5 animate-spin rounded-full border-2 border-t-white" />
                  <span>Loading...</span>
                </div>
              ) : (
                <div className="flex flex-row items-center justify-center gap-x-1">
                  <span>Next</span>
                  <FaArrowCircleRight />
                </div>
              )}
            </button>
          </div>
          <div className="flex flex-row items-center gap-x-5">
            <button
              className={"border-sky-blue rounded-lg border p-3"
                .concat(" ")
                .concat(
                  props.isFetching
                    ? "opacity-50"
                    : "transition-all ease-linear hover:opacity-50",
                )}
              type="button"
              disabled={props.isFetching}
              onClick={() => {
                props.onRefresh()
              }}
            >
              {props.isFetching &&
              !props.isFetchingNextPage &&
              !props.isFetchingPrevPage ? (
                <div className="flex flex-row items-center gap-x-2">
                  <div className="border-sky-blue h-5 w-5 animate-spin rounded-full border-2 border-t-white" />
                  <span>Loading...</span>
                </div>
              ) : (
                <div className="flex flex-row items-center justify-center gap-x-1">
                  <IoRefresh />
                  <span>Refresh</span>
                </div>
              )}
            </button>
            <button
              className={"border-sky-blue rounded-lg border p-3 transition-all ease-linear"
                .concat(" ")
                .concat(
                  checkboxes.canActivate() ? "hover:opacity-50" : "opacity-50",
                )}
              type="button"
              disabled={!checkboxes.canActivate()}
              onClick={() =>
                webhookActivator.mutate(
                  {
                    ids: checkboxes.getCheckedWebhookIDs(),
                  },
                  {
                    onSettled: () => {
                      props.afterActivate()
                    },
                  },
                )
              }
            >
              {webhookActivator.isPending ? (
                <div className="flex flex-row items-center gap-x-2">
                  <div className="border-sky-blue h-5 w-5 animate-spin rounded-full border-2 border-t-white" />
                  <span>Loading...</span>
                </div>
              ) : (
                <div className="flex flex-row items-center justify-center gap-x-1">
                  <GrDeploy />
                  <span>Activate Selected</span>
                </div>
              )}
            </button>
            <button
              className={"border-sky-blue rounded-lg border p-3 transition-all ease-linear"
                .concat(" ")
                .concat(
                  checkboxes.canDelete() ? "hover:opacity-50" : "opacity-50",
                )}
              type="button"
              disabled={!checkboxes.canDelete()}
              onClick={() =>
                webhookRemover.mutate(
                  {
                    ids: checkboxes.getCheckedWebhookIDs(),
                  },
                  {
                    onSettled: () => {
                      props.afterRemove()
                    },
                  },
                )
              }
            >
              {webhookRemover.isPending ? (
                <div className="flex flex-row items-center gap-x-2">
                  <div className="border-sky-blue h-5 w-5 animate-spin rounded-full border-2 border-t-white" />
                  <span>Loading...</span>
                </div>
              ) : (
                <div className="flex flex-row items-center justify-center gap-x-1">
                  <MdDeleteForever />
                  <span>Delete Selected</span>
                </div>
              )}
            </button>
          </div>
        </div>
        {/* Table Container */}
        <div className="w-full p-5">
          <table className="w-full">
            <thead>
              <tr className="[&>*]:border-b [&>*]:border-t [&>*]:border-b-white [&>*]:border-t-white [&>*]:border-opacity-50 [&>*]:p-5 [&>*]:text-left">
                <th>
                  <input
                    className="hover:cursor-pointer"
                    type="checkbox"
                    checked={checkboxes.isEverythingChecked()}
                    onChange={(e) => {
                      setSelected(checkboxes.checkAll(e.currentTarget.checked))
                    }}
                  />
                </th>
                <th>URL</th>
                <th>Created At</th>
                <th>Status</th>
                <th>Max Retries</th>
                <th>Max Blocks</th>
                <th>HTTP Timeout (ms)</th>
                <th>Blockchain</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {Array.from(selected.values()).map(
                ({ webhook, isChecked }, i) => (
                  <tr
                    className="[&>*]:border-b [&>*]:border-b-white [&>*]:border-opacity-50 [&>*]:p-5"
                    key={i}
                  >
                    <td>
                      <input
                        className="hover:cursor-pointer"
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setSelected(
                            checkboxes.checkOne(
                              webhook.id,
                              e.currentTarget.checked,
                            ),
                          )
                        }}
                      />
                    </td>
                    <td>{webhook.url}</td>
                    <td>{formatUTCDateStr(webhook.createdAt)}</td>
                    <td>{formatWebhookStatus(webhook.isActive)}</td>
                    <td>{webhook.maxRetries}</td>
                    <td>{webhook.maxBlocks}</td>
                    <td>{webhook.timeoutMs}</td>
                    <td>{webhook.blockchainId}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setWebhookToEdit(webhook)}
                      >
                        <FaEdit />
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
