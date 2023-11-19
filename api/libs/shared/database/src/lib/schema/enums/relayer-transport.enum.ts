import { mysqlEnum } from "drizzle-orm/mysql-core"

export enum RelayerTransports {
  HTTP = "HTTP",
  SMTP = "SMTP",
}

export const mysqlRelayerTransport = mysqlEnum("relayer_transport", [
  RelayerTransports.HTTP,
  RelayerTransports.SMTP,
])
