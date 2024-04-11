import {
  AccessTokenErrorCode,
  withApiAuthRequired,
  AccessTokenError,
  getAccessToken,
} from "@auth0/nextjs-auth0"

export const GET = withApiAuthRequired(async () => {
  // https://auth0.github.io/nextjs-auth0/types/session_get_access_token.GetAccessToken.html
  try {
    const result = await getAccessToken()
    return Response.json(result, { status: 200 })
  } catch (err) {
    if (err instanceof AccessTokenError) {
      if (err.code === AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN) {
        return Response.json(err, { status: 401 })
      } else {
        return Response.json(err, { status: 400 })
      }
    } else {
      console.error(err)
      return Response.json({}, { status: 500 })
    }
  }
})
