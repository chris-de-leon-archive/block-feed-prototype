export enum WebhookStatus {
  INACTIVE = "inactive",
  ACTIVE = "active",
}

export const formatUTCDateStr = (s: string) => {
  return new Date(s.concat(" UTC")).toLocaleString()
}

export const formatWebhookStatus = (isActive: number) => {
  return isActive === 1 ? WebhookStatus.ACTIVE : WebhookStatus.INACTIVE
}
