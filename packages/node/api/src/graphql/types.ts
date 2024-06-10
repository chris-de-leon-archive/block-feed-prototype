import { requireStripeSubscription } from "./middleware/require-subscription.middleware"
import { AsyncCallbackCache, CallbackCache } from "../caching"
import { YogaInitialContext } from "graphql-yoga"
import { User } from "@clerk/clerk-sdk-node"
import { zStripeEnv } from "./env"
import { Stripe } from "stripe"
import { z } from "zod"
import {
  RedisClusterVendor,
  DatabaseVendor,
  StripeVendor,
  ClerkVendor,
  ClerkUser,
  redis,
} from "@block-feed/vendors"

export type BaseContext = Readonly<{
  vendor: Readonly<{
    stripe: StripeVendor
    clerk: ClerkVendor
    db: DatabaseVendor
  }>
  caches: Readonly<{
    stripeCheckoutSess: AsyncCallbackCache<Stripe.Checkout.Session, string>
    clerkUser: AsyncCallbackCache<User, string>
    redisClusterConn: CallbackCache<
      RedisClusterVendor,
      z.infer<typeof redis.cluster.zEnv>
    >
  }>
  middlewares: Readonly<{
    requireStripeSubscription: typeof requireStripeSubscription
  }>
  env: Readonly<{
    stripe: z.infer<typeof zStripeEnv>
  }>
}>

export type YogaContext = Readonly<{
  yoga: YogaInitialContext
}>

export type ClerkContext = Readonly<{
  // NOTE: this property is only availble if the clerk plugin is added to Yoga
  clerk: Readonly<{
    user: ClerkUser
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
