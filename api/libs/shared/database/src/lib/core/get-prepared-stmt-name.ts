import * as crypto from "node:crypto"

export const getPreparedStmtName = (sql: string) => {
  return `p_${crypto.createHash("md5").update(sql).digest("hex")}`
}
