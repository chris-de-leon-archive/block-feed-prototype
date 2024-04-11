import { requireStripeSubscription } from "./middleware/require-subscription.middleware"
import { stripe } from "@block-feed/server/vendor/stripe"
import { redis } from "@block-feed/server/vendor/redis"
import { db } from "@block-feed/server/vendor/database"
import { auth } from "@block-feed/server/vendor/auth0"
import { YogaInitialContext } from "graphql-yoga"
import { ApiCache } from "../caching/api.cache"
import { UserInfoResponse } from "auth0"
import Stripe from "stripe"

export type BaseContext = Readonly<{
  vendor: Readonly<{
    redisWebhookLB: ReturnType<typeof redis.client.create>
    stripe: ReturnType<typeof stripe.client.create>
    auth0: ReturnType<typeof auth.client.create>
    db: ReturnType<typeof db.client.create>
  }>
  caches: Readonly<{
    stripe: ApiCache<Stripe.Response<Stripe.Checkout.Session>>
    auth0: ApiCache<UserInfoResponse>
  }>
  middlewares: Readonly<{
    requireStripeSubscription: typeof requireStripeSubscription
  }>
  env: Readonly<{
    CACHE_EXP_SEC?: number | undefined
  }>
}>

export type YogaContext = Readonly<{
  yoga: YogaInitialContext
}>

export type Auth0Context = Readonly<{
  auth0: Readonly<{
    user: UserInfoResponse
  }>
}>

export type StripeContext = Readonly<{
  stripe: Readonly<{
    subscription: Readonly<{
      data: Stripe.Subscription
    }>
  }>
}>

export type GraphQLContext = BaseContext & YogaContext

export type GraphQLAuthContext = BaseContext & YogaContext & Auth0Context

export type GraphQLStripeAuthContext = BaseContext &
  YogaContext &
  Auth0Context &
  StripeContext
