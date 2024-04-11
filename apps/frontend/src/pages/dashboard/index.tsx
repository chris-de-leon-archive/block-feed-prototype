import { withStripeSubscriptionRequired } from "@block-feed/guards/with-stripe-subscription-required"
import { WebhookSearchForm } from "@block-feed/components/dashboard/home/forms/webhook-search.form"
import { WebhookCreator } from "@block-feed/components/dashboard/home/webhook-creator"
import { WebhooksTable } from "@block-feed/components/dashboard/home/webhooks-table"
import { DashboardLoading } from "@block-feed/components/dashboard/loading"
import { interpretWebhookStatusString } from "@block-feed/shared/utils"
import { DashboardError } from "@block-feed/components/dashboard/error"
import { DashboardLayout } from "@block-feed/layouts/dashboard.layout"
import {
  defaultQueryRetryHandler,
  handleDashboardError,
} from "@block-feed/client/errors"
import { constants } from "@block-feed/shared/constants"
import * as client from "@block-feed/client"
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query"

export default withStripeSubscriptionRequired(({ user }) => {
  // Gets a reference to the next router and query client
  const router = useRouter()
  const qc = useQueryClient()

  // Component state
  const [filters, setFilters] = useState<
    Readonly<
      Partial<{
        blockchain: string
        status: string
        url: string
      }>
    >
  >({})

  // Gets a list of blockchains
  const blockchains = client.useGraphQLDashboardQuery(
    client.graphql(
      "query Blockchains {\n  blockchains {\n    id\n    url\n  }\n}",
    ),
    {},
  )

  // Gets the user's webhooks (this query will only
  // run if the previous query ran successfully)
  const webhooks = useInfiniteQuery({
    queryKey: ["webhooks", filters, blockchains],
    queryFn: async (ctx) => {
      return await client.makeAuthenticatedRequest(
        client.graphql(
          "query Webhooks($filters: WebhookFiltersInput!, $pagination: CursorPaginationInput!) {\n  webhooks(filters: $filters, pagination: $pagination) {\n    payload {\n      id\n      createdAt\n      url\n      customerId\n      blockchainId\n      isActive\n      isQueued\n      maxBlocks\n      maxRetries\n      timeoutMs\n    }\n    pagination {\n      hasNext\n      hasPrev\n    }\n  }\n}",
        ),
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
              status: { eq: interpretWebhookStatusString(filters.status) },
              blockchain: { eq: filters.blockchain },
              url: { like: filters.url },
            },
          },
        },
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
      return handleDashboardError(router, webhooks.error)
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
    if (blockchains.data.blockchains.length === 0) {
      return (
        <DashboardLayout ctx={{ user }}>
          <DashboardError msg="No blockchains are available right now please try again later" />
        </DashboardLayout>
      )
    }

    const blockchainIds = blockchains.data.blockchains.map(({ id }) => id)
    const webhookData =
      webhooks.data.pages.at(webhooks.data.pages.length - 1)?.webhooks
        .payload ?? []
    return (
      <DashboardLayout ctx={{ user }}>
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
              setFilters({
                blockchain: data.blockchain,
                status: data.status,
                url: data.url,
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
      </DashboardLayout>
    )
  }

  // In any other situation, render a loading screen
  return (
    <DashboardLayout ctx={{ user }}>
      <DashboardLoading />
    </DashboardLayout>
  )
})
