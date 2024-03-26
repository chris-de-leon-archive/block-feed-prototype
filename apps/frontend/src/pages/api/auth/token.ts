import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // https://github.com/auth0/nextjs-auth0/blob/main/EXAMPLES.md#access-an-external-api-from-an-api-route
  const result = await getAccessToken(req, res)
  return res.status(200).json(result)
})
