import { GraphQLAuthContext } from "../../../graphql/types"
import * as schema from "@block-feed/node-db"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  gqlInternalServerError,
  gqlBadRequestError,
} from "../../../graphql/errors"
import {
  zStripeCheckoutSessionMetadata,
  zStripeSubscriptionMetadata,
  extractStripeSubscription,
  extractStripeCustomer,
} from "../../../utils/stripe"

export const zInput = z.object({})

// NOTE: by default, Stripe will always create a new customer for every successful checkout session even
// if their email already exists (or has been used before in the past). The recommended way to prevent
// this is to listen to webhook events and store the customer and subscription data in our database. Then
// use the customer ID in our database for future checkout sessions so that duplicate customers are not
// created. However, webhook processing may be lagging behind either due to a Stripe outage, lambda cold
// starts, database connectivity, buggy code, etc. As we wait for the webhook event to be processed, our
// database will not contain the Stripe customer details or their relevant subscription info. As a result,
// it's not reliable to use our database to check if the Stripe customer/subscription already exists before
// creating the checkout session. This loophole will lead to the issue mentioned above where duplicate
// users will be created and hence duplicate charges will be incurred.
//
// NOTE: Stripe has a feature to limit users to 1 subscription based on the `customer_email` field or the
// `customer` field. If a duplicate email or customer ID is detected, the returned session URL will redirect
// to the customer's billing portal (see docs below). This feature makes it safe to call this endpoint multiple
// with the same email so long as the input email is VERIFIED and UNIQUE. If this is not the case, then this
// can lead to issues. Suppose we were using auth0 and we have both username-password auth and google-auth
// enabled. If there is a real user with a verified email (e.g. a@gmail.com) signed up, then a bad actor could
// use the username-password flow to create an account with an unverified email that's also named a@gmail.com.
// If we don't check that the user's email is verified before creating the checkout session, then the bad actor
// will be able to get a link to the billing portal of the real customer. Even though the attacker might not have
// control over the user's email (and thus shouldn't be able to access their portal), it still poses a potential
// attack surface. If every user of our service does have a verified and unique email, and this is checked
// before creating the checkout session, then this will lead to a secure and consistent checkout experience.
//
//  https://docs.stripe.com/payments/checkout/limit-subscriptions
//
// NOTE: Unfortunately, enforcing that emails are UNIQUE and VERIFIED can get very tricky when users are allowed
// to sign in / sign up with multiple OAuth providers. For example, suppose we're using Auth0 and enable Github
// auth and Google auth with account linking. Due to potential security risks, account linking is not automatic
// so there's a possibility that there will still be multiple users with the same email in our system. Furthermore,
// some providers don't include an `email_verified` field and some providers require additional steps to ensure
// emails are verified (e.g. in the traditional username-password flow, users need to verify their account by
// clicking a verification link in their email). With these obstacles in mind, this checkout flow takes on a
// different mental model. Instead of enforcing unique and verified emails and using the built-in Stripe feature
// that restricts customers to exactly one subscription, the handler below prevents duplicate customers, subs,
// and charges from being created while allowing multiple users of our service to have identical emails. Furthermore,
// calling the handler multiple times won't lead to race conditions either. More details on how this is accomplished
// are provided in the code below.
//
// NOTE: suppose a customer signs up for a subscription, cancels it, and renews it. In this case, we won't lose
// the stripe customer ID. When the customer renews their subscription (by purchasing a new one), the database
// will still store the old checkout session that's linked to the user's canceled subscription. This can be used
// to obtain the Stripe customer ID, which can then be attached to future checkout sessions. This allows us to
// determine whether the user is offered a free trial or not.
//
// NOTE: According to Stripe, subscription cancellation cannot be reversed (see link below). Also, subscriptions
// cannot be paused with metered billing. As a result, the only way for the user to re-subscribe is by purchasing
// another subscription.
//
//  Subscription cancellation cannot be reversed:
//
//    https://docs.stripe.com/billing/subscriptions/cancel?dashboard-or-api=api#reactivating-canceled-subscriptions
//
//  Subscriptions cannot be paused with metered billing:
//
//    https://docs.stripe.com/billing/subscriptions/trials#metered-billing-with-paused-subscriptions
//
// NOTE: if a user's Stripe customer account is deleted then recreated, then they will get another free trial. Also,
// if a user's Stripe customer account is deleted, and the checkout session linked to the user is NOT deleted from the
// database (potentially due to slow or failed webhook processing), then the stripe subscription middleware will throw
// a not subscribed error and the frontend will redirect the user back to checkout, which will lead them back to this
// handler. In this case, we would be creating a checkout session for a deleted customer which this handler will detect.
// Upon detecting that the customer is deleted, it will clean up the database and go through the normal flow as if this
// is the user's first time checking out.
//
export const handler = async (
  _: z.infer<typeof zInput>,
  ctx: GraphQLAuthContext,
) => {
  // Performs prechecks (e.g. if there's already an open checkout session return the url, etc.)
  const result = await resolveCheckoutSession(ctx)
  if (result.url != null) {
    return { url: result.url }
  }

  // Gets the user ID from the context
  const userId = ctx.clerk.user.id

  // Gets the user's primary email address
  const { primaryEmailAddress } = await ctx.caches.clerkUser.getOrSet(
    userId,
    userId,
  )
  if (primaryEmailAddress == null) {
    throw gqlBadRequestError(
      "user has no primary email address linked to their account",
    )
  }

  // Gets the email address
  const email = primaryEmailAddress.emailAddress

  // If there's no cached URL that we can return back to the user, then we need to generate a new checkout session.
  const clientReferenceId = randomUUID()
  const session = await ctx.vendor.stripe.client.checkout.sessions.create({
    billing_address_collection: "auto",
    payment_method_collection: "if_required",
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price: ctx.env.stripe.STRIPE_PRICE_ID,
      },
    ],
    // The stripe customer ID will be defined if the user has subscribed in the past
    ...(result.stripeCustomerId == null
      ? { customer_email: email }
      : { customer: result.stripeCustomerId }),
    success_url: ctx.env.stripe.STRIPE_CHECKOUT_SUCCESS_URL,
    cancel_url: ctx.env.stripe.STRIPE_CHECKOUT_CANCEL_URL,
    client_reference_id: clientReferenceId,
    subscription_data: {
      // Only offer a free trial if the user has never subscribed before
      ...(result.stripeCustomerId == null
        ? {
            trial_period_days: 7,
            trial_settings: {
              end_behavior: {
                missing_payment_method: "cancel",
              },
            },
          }
        : {}),
      metadata: { userId } satisfies z.infer<
        typeof zStripeSubscriptionMetadata
      >,
    },
    metadata: { userId } satisfies z.infer<
      typeof zStripeCheckoutSessionMetadata
    >,
    automatic_tax: {
      enabled: true,
    },
  })

  // This should never be null, but if it is then this is a huge error on Stripe's part
  const url = session.url
  if (url == null) {
    throw gqlInternalServerError("failed to get checkout session URL")
  }

  // Once the session is created, we'll record it in our database. If the application
  // is suddenly terminated right after we create the session but before we're able to
  // store it in the database (i.e. right here in the code), then this will create a
  // ghost session (i.e. a session that appears in Stripe but not in our systems). While
  // this may sound spooky, it actually isn't as bad as it sounds. The main consequence
  // of a ghost session is that it creates temporary bloat in the Stripe dashboard, but
  // even this can be mitigated by using a shorter session expiration time. It will not
  // lead to duplicate subscriptions / customers since the ghost session data is never
  // returned to the user.
  return await ctx.vendor.db.drizzle.transaction(async (tx) => {
    // The following code ensures that users are only able to see one checkout session link at a time
    // until it eventually expires or the subscription tied to it is canceled. Why is it necessary to
    // do this? If we leak multiple checkout session URLs to the user, then it is possible that they
    // may accidently subscribe more than once, which will lead to numerous problems like (1) duplicate
    // charges on their account, (2) multiple Stripe customer accounts being created for a single API
    // user, (3) multiple subscriptions being tied to a single user, and additional headaches cleaning
    // up the Stripe dashboard + database. The code below is designed to be concurrent safe and further
    // comments have been left behind to outline the thought process.
    if (result.stripeCustomerId != null) {
      // If we're here, then:
      //
      //  - The current user has canceled their subscription and is trying to renew it by purchasing a
      //    new one
      //  - Since this user has subscribed in the past, the database has a checkout session linked to
      //    this user and `result.clientReferenceId` can be used to locate said checkout session
      //  - The checkout session in the database is either expired or completed. If the checkout session
      //    is in a completed state, then it is linked to a subscription that is in a canceled state
      //  - The database may or may not already be up to date (i.e. another process may have already
      //    updated the DB by the time we get here)
      //
      // Regardless of whether the checkout session is expired or completed, we need to replace the old
      // checkout session data in the database with the newly created checkout session data. Our process
      // may not be the only one running, so there's several cases that we need to keep in mind here:
      //
      //  a. Our process could be executing at roughly the same time as another process
      //  b. Our process could be ahead of another process that's executing this code
      //  c. Our process could be behind another process that's executing this code
      //
      // To ensure that our code is concurrent safe in all these cases. We'll perform the following:
      //
      //  - First, we'll use `result.clientReferenceId` to locate and lock the corresponding checkout
      //    session in the database (which may be expired, completed, already up to date, or in the
      //    process of being updated)
      //  - If we receive no rows back from the previous step, then this means one of two things.
      //    There might not be any rows with the specified `result.clientReferenceId` (in which case
      //    this means another process has already updated the data) OR another process has obtained
      //    a lock on the row and is currently updating the data. In either case, the database is up
      //    to date or will be up to date.
      //  - If we do receive some rows back from the previous step, then this means that (1) the old
      //    session still exists and (2) we were able to acquire a lock on the row. In which case, it
      //    is safe to perform an update.
      //
      const rows = await tx
        .select()
        .from(schema.checkoutSession)
        .for("update", { skipLocked: true })
        .where(
          eq(
            schema.checkoutSession.clientReferenceId,
            result.clientReferenceId,
          ),
        )

      if (rows.length !== 0) {
        await tx
          .update(schema.checkoutSession)
          .set({
            customerId: userId,
            sessionId: session.id,
            clientReferenceId,
            url,
          })
          .where(
            eq(
              schema.checkoutSession.clientReferenceId,
              result.clientReferenceId,
            ),
          )
      }
    } else {
      // If we're here, then:
      //
      //  - The current user has not purchased a subscription in the past before
      //  - Since this user hasn't subscribed in the past, the database might not have a
      //    checkout session linked to this user (in this case `result.clientReferenceId`
      //    will be undefined)
      //  - If a checkout session DOES exist in the database, then it must be in an expired
      //    state (in this case `result.clientReferenceId` will be defined)
      //  - The database may or may not already be up to date (i.e. another process may have
      //    already updated the DB by the time we get here)
      //
      // Regardless of whether the checkout session does not exist or is expired, we need to
      // ensure that the database is updated with the newly created checkout session data.
      // Our process may not be the only one running, so there's several cases that we need
      // to keep in mind here:
      //
      //  a. Our process could be executing at roughly the same time as another process
      //  b. Our process could be ahead of another process that's executing this code
      //  c. Our process could be behind another process that's executing this code
      //
      // To ensure that our code is concurrent safe in all these cases. We'll perform the following:
      //
      //  - If the checkout session does not exist (i.e. `result.clientReferenceId` is not defined)
      //    then we need to insert the checkout session. If the insert operation doesn't actually add
      //    any rows (possibly because another process is running in parallel and already added the
      //    row), then this is okay - we simply return the row that the other process created.
      //  - If the checkout session exists (i.e. `result.clientReferenceId` is defined), then we
      //    need to locate and lock the corresponding checkout session in the database (which may be
      //    expired, already up to date, or in the process of being updated)
      //  - If we receive no rows back from the previous step, then this means one of two things.
      //    There might not be any rows with the specified `result.clientReferenceId` (in which case
      //    this means another process has already updated the data) OR another process has obtained
      //    a lock on the row and is currently updating the data. In either case, the database is up
      //    to date or will be up to date.
      //  - If we do receive some rows back from the previous step, then this means that (1) the old
      //    expired session still exists and (2) we were able to acquire a lock on the row. In which
      //    case, it is safe to perform an update.
      //
      if (result.clientReferenceId == null) {
        await tx.insert(schema.checkoutSession).ignore().values({
          id: randomUUID(),
          customerId: userId,
          sessionId: session.id,
          clientReferenceId,
          url,
        })
      } else {
        const rows = await tx
          .select()
          .from(schema.checkoutSession)
          .for("update", { skipLocked: true })
          .where(
            eq(
              schema.checkoutSession.clientReferenceId,
              result.clientReferenceId,
            ),
          )

        if (rows.length !== 0) {
          await tx
            .update(schema.checkoutSession)
            .set({
              customerId: userId,
              sessionId: session.id,
              clientReferenceId,
              url,
            })
            .where(
              eq(
                schema.checkoutSession.clientReferenceId,
                result.clientReferenceId,
              ),
            )
        }
      }
    }

    // At this point, the database should be up to date with the latest checkout data, so
    // we'll query it and return it to the client.
    return await tx.query.checkoutSession
      .findFirst({
        where: eq(schema.checkoutSession.customerId, userId),
      })
      .then((res) => {
        if (res == null) {
          throw gqlInternalServerError("unable to create checkout session")
        }
        return { url: res.url }
      })
  })
}

const resolveCheckoutSession = async (ctx: GraphQLAuthContext) => {
  // Gets the user from the context
  const userId = ctx.clerk.user.id

  // Defines helper variable(s)
  const empty = {
    clientReferenceId: undefined,
    stripeCustomerId: undefined,
    url: undefined,
  }

  // Queries the database for any existing sessions
  const existingSession =
    await ctx.vendor.db.drizzle.query.checkoutSession.findFirst({
      where: eq(schema.checkoutSession.customerId, userId),
    })

  // If the database does not have a checkout session, then we need to create a new one
  if (existingSession == null) {
    return empty
  }

  // If an existing session was found, we need to handle it based on its status. First
  // let's query the cache / Stripe API for the additional checkout session details
  const sess = await ctx.caches.stripeCheckoutSess.getOrSet(
    userId,
    existingSession.sessionId,
  )

  // If the session is open, then we'll return the existing checkout session URL
  if (sess.status === "open") {
    return { url: existingSession.url }
  }

  // If the session is expired, then we need to generate a new session and update the DB
  if (sess.status === "expired") {
    return {
      clientReferenceId: existingSession.clientReferenceId,
      stripeCustomerId:
        typeof sess.customer === "string" ? sess.customer : sess.customer?.id,
    }
  }

  // If the session is already complete, then there are several cases to deal with.
  if (sess.status === "complete") {
    // If the customer has been deleted, then we need to make sure the checkout session
    // in the database is also deleted. This will also reset the free trial offer. In
    // this case, we want to mimic a situation where no existing session existed in the
    // database.
    const customer = await extractStripeCustomer(ctx.vendor.stripe, sess)
    if (customer != null && customer.deleted) {
      return await ctx.vendor.db.drizzle
        .delete(schema.checkoutSession)
        .where(eq(schema.checkoutSession.id, existingSession.id))
        .then(() => empty)
    }

    // If the subscription associated with the checkout session has been cancelled, then we
    // need to generate a new checkout session.
    const sub = await extractStripeSubscription(ctx.vendor.stripe, sess)
    if (sub != null && sub.status === "canceled") {
      return {
        clientReferenceId: existingSession.clientReferenceId,
        stripeCustomerId:
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      }
    }

    // Otherwise, the subscription is still active, and we return the URL to the customer's
    // portal. Notice here that we intentionally DO NOT create a billing portal session using
    // the Stripe customer ID. This helps us avoid making an additional API calls to Stripe.
    return { url: ctx.env.stripe.STRIPE_CUSTOMER_PORTAL_URL }
  }

  // Any other status code is considered unexpected and should cause an error
  throw gqlInternalServerError(
    `invalid checkout session status: ${sess.status}`,
  )
}
