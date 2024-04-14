import type { requireStripeSubscription } from "./middleware/require-subscription.middleware"
import type { SignedInAuthObject } from "@clerk/clerk-sdk-node"
import type { YogaInitialContext } from "graphql-yoga"
import type { ApiCache } from "../caching/api.cache"
import type { Stripe } from "stripe"
import type {
  DatabaseVendor,
  StripeVendor,
  RedisVendor,
  ClerkVendor,
} from "@block-feed/vendors"

export type BaseContext = Readonly<{
  vendor: Readonly<{
    redisWebhookLB: RedisVendor
    stripe: StripeVendor
    clerk: ClerkVendor
    db: DatabaseVendor
  }>
  caches: Readonly<{
    stripe: ApiCache<Stripe.Response<Stripe.Checkout.Session>>
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

export type ClerkContext = Readonly<{
  clerk: Readonly<{
    user: SignedInAuthObject
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

export type GraphQLAuthContext = BaseContext & YogaContext & ClerkContext

export type GraphQLStripeAuthContext = BaseContext &
  YogaContext &
  ClerkContext &
  StripeContext
