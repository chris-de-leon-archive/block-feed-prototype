"use client"

import { WebhookSearchForm } from "@block-feed/dashboard/components/home/forms/webhook-search.form"
import { WebhookCreator } from "@block-feed/dashboard/components/home/webhooks-creator"
import { WebhooksTable } from "@block-feed/dashboard/components/home/webhooks-table"
import { constants } from "@block-feed/shared"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { WebhookStatus } from "../utils"
import { useAuth } from "@clerk/nextjs"
import {
  useGraphQLDashboardQuery,
  defaultQueryRetryHandler,
  handleDashboardError,
  BlockchainsDocument,
  makeRequestOrThrow,
  WebhooksDocument,
} from "@block-feed/dashboard/client"
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query"

export default function Dashboard() {
  // Defines helper hooks
  const { getToken } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()

  // Component state
  const [filters, setFilters] = useState<
    Readonly<
      Partial<{
        blockchain: string
        isActive: boolean
        url: string
      }>
    >
  >({})

  // Gets a list of blockchains
  const blockchains = useGraphQLDashboardQuery(
    BlockchainsDocument,
    {},
    getToken,
  )

  // Gets the user's webhooks (this query will only
  // run if the previous query ran successfully)
  const webhooks = useInfiniteQuery({
    queryKey: ["webhooks", filters, blockchains],
    queryFn: async (ctx) => {
      return await makeRequestOrThrow(
        WebhooksDocument,
        {
          pagination: {
            limit: constants.pagination.limits.LIMIT.MAX,
            cursor:
              ctx.pageParam.id !== ""
                ? {
                    id: ctx.pageParam.id,
                    reverse: ctx.pageParam.reverse,
                  }
                : null,
          },
          filters: {
            and: {
              blockchain: { eq: filters.blockchain },
              isActive: { eq: filters.isActive },
              url: { like: filters.url },
            },
          },
        },
        await getToken(),
      )
    },
    retry: defaultQueryRetryHandler,
    maxPages: 1,
    placeholderData: keepPreviousData,
    initialPageParam: { reverse: false, id: "" },
    getNextPageParam: (lastPage, pages) => {
      if (pages.length === 0) {
        return {
          reverse: false,
          id: "",
        }
      }

      const payload = lastPage.webhooks.payload
      if (lastPage.webhooks.pagination.hasNext) {
        return {
          reverse: false,
          id: payload.at(payload.length - 1)?.id ?? "",
        }
      }

      return null
    },
    getPreviousPageParam: (firstPage, pages) => {
      if (pages.length === 0) {
        return {
          reverse: false,
          id: "",
        }
      }

      const payload = firstPage.webhooks.payload
      if (firstPage.webhooks.pagination.hasPrev) {
        return {
          reverse: true,
          id: payload.at(0)?.id ?? "",
        }
      }

      return null
    },
  })

  // If an error occurred, handle it accordingly
  useEffect(() => {
    if (webhooks.error != null) {
      handleDashboardError(router, webhooks.error)
    }
  }, [webhooks.error])

  // A helper function that resets pagination state
  const resetPagination = () => {
    qc.setQueryData(["webhooks", filters], () => ({
      pages: [],
      pageParams: [],
    }))
    webhooks.refetch()
  }

  // If no errors occurred and we were able to get the data - render the dashboard
  if (blockchains.data != null && webhooks.data != null) {
    const blockchainIds = blockchains.data.blockchains.map(({ id }) => id)
    const webhookData =
      webhooks.data.pages.at(webhooks.data.pages.length - 1)?.webhooks
        .payload ?? []
    return (
      <div className="flex w-full flex-col items-center gap-y-10 p-5 text-white">
        <WebhookCreator
          blockchains={blockchainIds}
          afterCreate={() => {
            resetPagination()
          }}
        />
        <WebhookSearchForm
          blockchains={blockchainIds}
          disabled={webhooks.isFetching}
          onSubmit={(data) => {
            const blockchain =
              data.blockchain != null && data.blockchain !== ""
                ? data.blockchain
                : undefined

            const isActive =
              data.status == null && data.status !== ""
                ? data.status === WebhookStatus.ACTIVE
                : undefined

            const url =
              data.url != null && data.url !== "" ? data.url : undefined

            setFilters({
              blockchain,
              isActive,
              url,
            })
          }}
          onParseError={(err) => {
            console.error(err)
            setFilters({})
          }}
        />
        <WebhooksTable
          webhooks={webhookData}
          isFetching={webhooks.isFetching}
          isFetchingNextPage={webhooks.isFetchingNextPage}
          isFetchingPrevPage={webhooks.isFetchingPreviousPage}
          hasNextPage={webhooks.hasNextPage}
          hasPrevPage={webhooks.hasPreviousPage}
          afterActivate={() => {
            webhooks.refetch()
          }}
          afterRemove={() => {
            resetPagination()
          }}
          afterEdit={() => {
            webhooks.refetch()
          }}
          onRefresh={() => {
            webhooks.refetch()
          }}
          onNextPage={() => {
            webhooks.fetchNextPage()
          }}
          onPrevPage={() => {
            webhooks.fetchPreviousPage()
          }}
        />
      </div>
    )
  }

  return <></>
}
