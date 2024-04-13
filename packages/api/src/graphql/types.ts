import type { requireStripeSubscription } from "./middleware/require-subscription.middleware"
import type { YogaInitialContext } from "graphql-yoga"
import type { ApiCache } from "../caching/api.cache"
import type { UserInfoResponse } from "auth0"
import type { Stripe } from "stripe"
import type {
  DatabaseVendor,
  StripeVendor,
  RedisVendor,
  Auth0Vendor,
} from "@block-feed/vendors"

export type BaseContext = Readonly<{
  vendor: Readonly<{
    redisWebhookLB: RedisVendor
    stripe: StripeVendor
    auth0: Auth0Vendor
    db: DatabaseVendor
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
