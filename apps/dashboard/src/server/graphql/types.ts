import { requireStripeSubscription } from "./middleware/require-subscription.middleware"
import { AsyncCallbackCache, CallbackCache } from "@block-feed/node-caching"
import { rediscluster } from "@block-feed/node-providers-redis"
import { stripe } from "@block-feed/node-providers-stripe"
import { mysql } from "@block-feed/node-providers-mysql"
import { clerk } from "@block-feed/node-providers-clerk"
import { YogaInitialContext } from "graphql-yoga"
import { User } from "@clerk/clerk-sdk-node"
import { zStripeEnv } from "./env"
import { Stripe } from "stripe"
import { z } from "zod"

export type BaseContext = Readonly<{
  providers: Readonly<{
    stripe: stripe.Provider
    clerk: clerk.Provider
    mysql: mysql.Provider
  }>
  caches: Readonly<{
    stripeCheckoutSess: AsyncCallbackCache<Stripe.Checkout.Session, string>
    clerkUser: AsyncCallbackCache<User, string>
    redisClusterConn: CallbackCache<
      rediscluster.Provider,
      z.infer<typeof rediscluster.zEnv>
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
    user: clerk.User
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
