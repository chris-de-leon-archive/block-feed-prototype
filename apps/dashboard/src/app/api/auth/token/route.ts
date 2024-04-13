import { AccessTokenError, getAccessToken } from "@auth0/nextjs-auth0"

export const GET = async () => {
  // https://auth0.github.io/nextjs-auth0/types/session_get_access_token.GetAccessToken.html
  try {
    const result = await getAccessToken()
    return Response.json(result, { status: 200 })
  } catch (err) {
    console.error(err)
    if (err instanceof AccessTokenError) {
      return Response.json(
        {
          code: err.code,
          name: err.name,
          message: err.message,
        },
        { status: 401 },
      )
    } else {
      return Response.json({}, { status: 500 })
    }
  }
}
