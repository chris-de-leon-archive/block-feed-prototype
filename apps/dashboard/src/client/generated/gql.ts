/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 */
const documents = {
    "query Blockchains {\n  blockchains {\n    id\n  }\n}": types.BlockchainsDocument,
    "mutation CreateBillingPortalSession {\n  createBillingPortalSession {\n    url\n  }\n}": types.CreateBillingPortalSessionDocument,
    "mutation CreateCheckoutSession {\n  createCheckoutSession {\n    url\n  }\n}": types.CreateCheckoutSessionDocument,
    "query StripeSubscription {\n  stripeSubscription {\n    id\n    status\n  }\n}": types.StripeSubscriptionDocument,
    "mutation ActivateWebhooks($ids: [String!]!) {\n  webhookActivate(ids: $ids) {\n    count\n  }\n}": types.ActivateWebhooksDocument,
    "mutation CreateWebhook($data: WebhookCreateInput!) {\n  webhookCreate(data: $data) {\n    id\n  }\n}": types.CreateWebhookDocument,
    "query Webhooks($filters: WebhookFiltersInput!, $pagination: CursorPaginationInput!) {\n  webhooks(filters: $filters, pagination: $pagination) {\n    payload {\n      id\n      createdAt\n      url\n      customerId\n      blockchainId\n      isActive\n      maxBlocks\n      maxRetries\n      timeoutMs\n    }\n    pagination {\n      hasNext\n      hasPrev\n    }\n  }\n}": types.WebhooksDocument,
    "query Webhook($id: String!) {\n  webhook(id: $id) {\n    id\n    createdAt\n    url\n    customerId\n    blockchainId\n    isActive\n    maxBlocks\n    maxRetries\n    timeoutMs\n  }\n}": types.WebhookDocument,
    "mutation RemoveWebhooks($ids: [String!]!) {\n  webhookRemove(ids: $ids) {\n    count\n  }\n}": types.RemoveWebhooksDocument,
    "mutation UpdateWebhook($id: String!, $data: WebhookUpdateInput!) {\n  webhookUpdate(id: $id, data: $data) {\n    count\n  }\n}": types.UpdateWebhookDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Blockchains {\n  blockchains {\n    id\n  }\n}"): (typeof documents)["query Blockchains {\n  blockchains {\n    id\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateBillingPortalSession {\n  createBillingPortalSession {\n    url\n  }\n}"): (typeof documents)["mutation CreateBillingPortalSession {\n  createBillingPortalSession {\n    url\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateCheckoutSession {\n  createCheckoutSession {\n    url\n  }\n}"): (typeof documents)["mutation CreateCheckoutSession {\n  createCheckoutSession {\n    url\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query StripeSubscription {\n  stripeSubscription {\n    id\n    status\n  }\n}"): (typeof documents)["query StripeSubscription {\n  stripeSubscription {\n    id\n    status\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation ActivateWebhooks($ids: [String!]!) {\n  webhookActivate(ids: $ids) {\n    count\n  }\n}"): (typeof documents)["mutation ActivateWebhooks($ids: [String!]!) {\n  webhookActivate(ids: $ids) {\n    count\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateWebhook($data: WebhookCreateInput!) {\n  webhookCreate(data: $data) {\n    id\n  }\n}"): (typeof documents)["mutation CreateWebhook($data: WebhookCreateInput!) {\n  webhookCreate(data: $data) {\n    id\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Webhooks($filters: WebhookFiltersInput!, $pagination: CursorPaginationInput!) {\n  webhooks(filters: $filters, pagination: $pagination) {\n    payload {\n      id\n      createdAt\n      url\n      customerId\n      blockchainId\n      isActive\n      maxBlocks\n      maxRetries\n      timeoutMs\n    }\n    pagination {\n      hasNext\n      hasPrev\n    }\n  }\n}"): (typeof documents)["query Webhooks($filters: WebhookFiltersInput!, $pagination: CursorPaginationInput!) {\n  webhooks(filters: $filters, pagination: $pagination) {\n    payload {\n      id\n      createdAt\n      url\n      customerId\n      blockchainId\n      isActive\n      maxBlocks\n      maxRetries\n      timeoutMs\n    }\n    pagination {\n      hasNext\n      hasPrev\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Webhook($id: String!) {\n  webhook(id: $id) {\n    id\n    createdAt\n    url\n    customerId\n    blockchainId\n    isActive\n    maxBlocks\n    maxRetries\n    timeoutMs\n  }\n}"): (typeof documents)["query Webhook($id: String!) {\n  webhook(id: $id) {\n    id\n    createdAt\n    url\n    customerId\n    blockchainId\n    isActive\n    maxBlocks\n    maxRetries\n    timeoutMs\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RemoveWebhooks($ids: [String!]!) {\n  webhookRemove(ids: $ids) {\n    count\n  }\n}"): (typeof documents)["mutation RemoveWebhooks($ids: [String!]!) {\n  webhookRemove(ids: $ids) {\n    count\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateWebhook($id: String!, $data: WebhookUpdateInput!) {\n  webhookUpdate(id: $id, data: $data) {\n    count\n  }\n}"): (typeof documents)["mutation UpdateWebhook($id: String!, $data: WebhookUpdateInput!) {\n  webhookUpdate(id: $id, data: $data) {\n    count\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;