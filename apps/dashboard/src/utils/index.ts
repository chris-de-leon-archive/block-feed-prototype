import { WebhookStatus } from "@block-feed/shared"

export const formatUTCDateStr = (s: string) => {
  return new Date(s.concat(" UTC")).toLocaleString()
}

export const interpretWebhookStatus = (
  webhook: Readonly<{
    isActive: number
    isQueued: number
  }>,
) => {
  if (webhook.isActive === 1) {
    return WebhookStatus.ACTIVE
  }
  if (webhook.isQueued === 1) {
    return WebhookStatus.PENDING
  }
  return WebhookStatus.INACTIVE
}

export const interpretWebhookStatusString = (
  status: string | null | undefined,
) => {
  if (status == null) {
    return undefined
  }

  return {
    [WebhookStatus.INACTIVE]: "INACTIVE" as const,
    [WebhookStatus.PENDING]: "PENDING" as const,
    [WebhookStatus.ACTIVE]: "ACTIVE" as const,
  }[status.toLowerCase()]
}
