import { GraphQLClient, RequestOptions } from "graphql-request"
import { GraphQLError, print } from "graphql"
import { DocumentNode } from "graphql"
export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K]
}
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>
}
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>
}
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never }
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never
    }
type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string }
  String: { input: string; output: string }
  Boolean: { input: boolean; output: boolean }
  Int: { input: number; output: number }
  Float: { input: number; output: number }
}

export type Blockchain = {
  __typename?: "Blockchain"
  id: Scalars["String"]["output"]
  url: Scalars["String"]["output"]
}

export type Count = {
  __typename?: "Count"
  count: Scalars["Int"]["output"]
}

export type CursorInput = {
  id: Scalars["String"]["input"]
  reverse: Scalars["Boolean"]["input"]
}

export type CursorPaginationInput = {
  cursor?: InputMaybe<CursorInput>
  limit: Scalars["Int"]["input"]
}

export type Mutation = {
  __typename?: "Mutation"
  createBillingPortalSession: StripeSession
  createCheckoutSession: StripeSession
  webhookActivate: Count
  webhookCreate: Uuid
  webhookRemove: Count
  webhookUpdate: Count
}

export type MutationWebhookActivateArgs = {
  ids: Array<Scalars["String"]["input"]>
}

export type MutationWebhookCreateArgs = {
  data: WebhookCreateInput
}

export type MutationWebhookRemoveArgs = {
  ids: Array<Scalars["String"]["input"]>
}

export type MutationWebhookUpdateArgs = {
  data: WebhookUpdateInput
  id: Scalars["String"]["input"]
}

export type PaginationFlags = {
  __typename?: "PaginationFlags"
  hasNext: Scalars["Boolean"]["output"]
  hasPrev: Scalars["Boolean"]["output"]
}

export type Query = {
  __typename?: "Query"
  blockchains: Array<Blockchain>
  stripeSubscription: StripeSubscription
  webhook: Webhook
  webhooks: Webhooks
}

export type QueryWebhookArgs = {
  id: Scalars["String"]["input"]
}

export type QueryWebhooksArgs = {
  filters: WebhookFiltersInput
  pagination: CursorPaginationInput
}

export type StringEqFilterInput = {
  eq?: InputMaybe<Scalars["String"]["input"]>
}

export type StringLikeFilterInput = {
  like?: InputMaybe<Scalars["String"]["input"]>
}

export type StripeSession = {
  __typename?: "StripeSession"
  url: Scalars["String"]["output"]
}

export type StripeSubscription = {
  __typename?: "StripeSubscription"
  id: Scalars["String"]["output"]
  status: StripeSubscriptionStatus
}

export enum StripeSubscriptionStatus {
  Active = "active",
  Canceled = "canceled",
  Incomplete = "incomplete",
  IncompleteExpired = "incomplete_expired",
  PastDue = "past_due",
  Paused = "paused",
  Trialing = "trialing",
  Unpaid = "unpaid",
}

export type Uuid = {
  __typename?: "UUID"
  id: Scalars["String"]["output"]
}

export type Webhook = {
  __typename?: "Webhook"
  blockchainId: Scalars["String"]["output"]
  createdAt: Scalars["String"]["output"]
  customerId: Scalars["String"]["output"]
  id: Scalars["String"]["output"]
  isActive: Scalars["Int"]["output"]
  isQueued: Scalars["Int"]["output"]
  maxBlocks: Scalars["Int"]["output"]
  maxRetries: Scalars["Int"]["output"]
  timeoutMs: Scalars["Int"]["output"]
  url: Scalars["String"]["output"]
}

export type WebhookCreateInput = {
  blockchainId: Scalars["String"]["input"]
  maxBlocks: Scalars["Int"]["input"]
  maxRetries: Scalars["Int"]["input"]
  timeoutMs: Scalars["Int"]["input"]
  url: Scalars["String"]["input"]
}

export type WebhookFiltersBodyInput = {
  blockchain?: InputMaybe<StringEqFilterInput>
  status?: InputMaybe<WebhookStatusFilterInput>
  url?: InputMaybe<StringLikeFilterInput>
}

export type WebhookFiltersInput = {
  and?: InputMaybe<WebhookFiltersBodyInput>
}

export enum WebhookStatus {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Pending = "PENDING",
}

export type WebhookStatusFilterInput = {
  eq?: InputMaybe<WebhookStatus>
}

export type WebhookUpdateInput = {
  maxBlocks?: InputMaybe<Scalars["Int"]["input"]>
  maxRetries?: InputMaybe<Scalars["Int"]["input"]>
  timeoutMs?: InputMaybe<Scalars["Int"]["input"]>
  url?: InputMaybe<Scalars["String"]["input"]>
}

export type Webhooks = {
  __typename?: "Webhooks"
  pagination: PaginationFlags
  payload: Array<Webhook>
}

export type BlockchainsQueryVariables = Exact<{ [key: string]: never }>

export type BlockchainsQuery = {
  __typename?: "Query"
  blockchains: Array<{ __typename?: "Blockchain"; id: string; url: string }>
}

export type CreateBillingPortalSessionMutationVariables = Exact<{
  [key: string]: never
}>

export type CreateBillingPortalSessionMutation = {
  __typename?: "Mutation"
  createBillingPortalSession: { __typename?: "StripeSession"; url: string }
}

export type CreateCheckoutSessionMutationVariables = Exact<{
  [key: string]: never
}>

export type CreateCheckoutSessionMutation = {
  __typename?: "Mutation"
  createCheckoutSession: { __typename?: "StripeSession"; url: string }
}

export type StripeSubscriptionQueryVariables = Exact<{ [key: string]: never }>

export type StripeSubscriptionQuery = {
  __typename?: "Query"
  stripeSubscription: {
    __typename?: "StripeSubscription"
    id: string
    status: StripeSubscriptionStatus
  }
}

export type ActivateWebhooksMutationVariables = Exact<{
  ids: Array<Scalars["String"]["input"]> | Scalars["String"]["input"]
}>

export type ActivateWebhooksMutation = {
  __typename?: "Mutation"
  webhookActivate: { __typename?: "Count"; count: number }
}

export type CreateWebhookMutationVariables = Exact<{
  data: WebhookCreateInput
}>

export type CreateWebhookMutation = {
  __typename?: "Mutation"
  webhookCreate: { __typename?: "UUID"; id: string }
}

export type WebhooksQueryVariables = Exact<{
  filters: WebhookFiltersInput
  pagination: CursorPaginationInput
}>

export type WebhooksQuery = {
  __typename?: "Query"
  webhooks: {
    __typename?: "Webhooks"
    payload: Array<{
      __typename?: "Webhook"
      id: string
      createdAt: string
      url: string
      customerId: string
      blockchainId: string
      isActive: number
      isQueued: number
      maxBlocks: number
      maxRetries: number
      timeoutMs: number
    }>
    pagination: {
      __typename?: "PaginationFlags"
      hasNext: boolean
      hasPrev: boolean
    }
  }
}

export type WebhookQueryVariables = Exact<{
  id: Scalars["String"]["input"]
}>

export type WebhookQuery = {
  __typename?: "Query"
  webhook: {
    __typename?: "Webhook"
    id: string
    createdAt: string
    url: string
    customerId: string
    blockchainId: string
    isActive: number
    isQueued: number
    maxBlocks: number
    maxRetries: number
    timeoutMs: number
  }
}

export type RemoveWebhooksMutationVariables = Exact<{
  ids: Array<Scalars["String"]["input"]> | Scalars["String"]["input"]
}>

export type RemoveWebhooksMutation = {
  __typename?: "Mutation"
  webhookRemove: { __typename?: "Count"; count: number }
}

export type UpdateWebhookMutationVariables = Exact<{
  id: Scalars["String"]["input"]
  data: WebhookUpdateInput
}>

export type UpdateWebhookMutation = {
  __typename?: "Mutation"
  webhookUpdate: { __typename?: "Count"; count: number }
}

export const BlockchainsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Blockchains" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "blockchains" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "url" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode
export const CreateBillingPortalSessionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateBillingPortalSession" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createBillingPortalSession" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "url" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode
export const CreateCheckoutSessionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateCheckoutSession" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createCheckoutSession" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "url" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode
export const StripeSubscriptionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "StripeSubscription" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "stripeSubscription" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode
export const ActivateWebhooksDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "ActivateWebhooks" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "ids" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "ListType",
              type: {
                kind: "NonNullType",
                type: {
                  kind: "NamedType",
                  name: { kind: "Name", value: "String" },
                },
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "webhookActivate" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "ids" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "ids" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "count" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode
export const CreateWebhookDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateWebhook" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "data" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "WebhookCreateInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "webhookCreate" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "data" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "data" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode
export const WebhooksDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Webhooks" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filters" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "WebhookFiltersInput" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "pagination" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "CursorPaginationInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "webhooks" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "filters" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filters" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pagination" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "pagination" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "payload" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "createdAt" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "url" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "customerId" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "blockchainId" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "isActive" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "isQueued" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "maxBlocks" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "maxRetries" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "timeoutMs" },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pagination" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasNext" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasPrev" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode
export const WebhookDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Webhook" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "webhook" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "url" } },
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "blockchainId" },
                },
                { kind: "Field", name: { kind: "Name", value: "isActive" } },
                { kind: "Field", name: { kind: "Name", value: "isQueued" } },
                { kind: "Field", name: { kind: "Name", value: "maxBlocks" } },
                { kind: "Field", name: { kind: "Name", value: "maxRetries" } },
                { kind: "Field", name: { kind: "Name", value: "timeoutMs" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode
export const RemoveWebhooksDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "RemoveWebhooks" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "ids" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "ListType",
              type: {
                kind: "NonNullType",
                type: {
                  kind: "NamedType",
                  name: { kind: "Name", value: "String" },
                },
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "webhookRemove" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "ids" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "ids" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "count" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode
export const UpdateWebhookDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateWebhook" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "data" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "WebhookUpdateInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "webhookUpdate" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "data" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "data" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "count" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>

const defaultWrapper: SdkFunctionWrapper = (
  action,
  _operationName,
  _operationType,
  _variables,
) => action()
const BlockchainsDocumentString = print(BlockchainsDocument)
const CreateBillingPortalSessionDocumentString = print(
  CreateBillingPortalSessionDocument,
)
const CreateCheckoutSessionDocumentString = print(CreateCheckoutSessionDocument)
const StripeSubscriptionDocumentString = print(StripeSubscriptionDocument)
const ActivateWebhooksDocumentString = print(ActivateWebhooksDocument)
const CreateWebhookDocumentString = print(CreateWebhookDocument)
const WebhooksDocumentString = print(WebhooksDocument)
const WebhookDocumentString = print(WebhookDocument)
const RemoveWebhooksDocumentString = print(RemoveWebhooksDocument)
const UpdateWebhookDocumentString = print(UpdateWebhookDocument)
export function getSdk(
  client: GraphQLClient,
  withWrapper: SdkFunctionWrapper = defaultWrapper,
) {
  return {
    Blockchains(
      variables?: BlockchainsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: BlockchainsQuery
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<BlockchainsQuery>(
            BlockchainsDocumentString,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders },
          ),
        "Blockchains",
        "query",
        variables,
      )
    },
    CreateBillingPortalSession(
      variables?: CreateBillingPortalSessionMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: CreateBillingPortalSessionMutation
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<CreateBillingPortalSessionMutation>(
            CreateBillingPortalSessionDocumentString,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders },
          ),
        "CreateBillingPortalSession",
        "mutation",
        variables,
      )
    },
    CreateCheckoutSession(
      variables?: CreateCheckoutSessionMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: CreateCheckoutSessionMutation
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<CreateCheckoutSessionMutation>(
            CreateCheckoutSessionDocumentString,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders },
          ),
        "CreateCheckoutSession",
        "mutation",
        variables,
      )
    },
    StripeSubscription(
      variables?: StripeSubscriptionQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: StripeSubscriptionQuery
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<StripeSubscriptionQuery>(
            StripeSubscriptionDocumentString,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders },
          ),
        "StripeSubscription",
        "query",
        variables,
      )
    },
    ActivateWebhooks(
      variables: ActivateWebhooksMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: ActivateWebhooksMutation
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<ActivateWebhooksMutation>(
            ActivateWebhooksDocumentString,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders },
          ),
        "ActivateWebhooks",
        "mutation",
        variables,
      )
    },
    CreateWebhook(
      variables: CreateWebhookMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: CreateWebhookMutation
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<CreateWebhookMutation>(
            CreateWebhookDocumentString,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders },
          ),
        "CreateWebhook",
        "mutation",
        variables,
      )
    },
    Webhooks(
      variables: WebhooksQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: WebhooksQuery
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<WebhooksQuery>(WebhooksDocumentString, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        "Webhooks",
        "query",
        variables,
      )
    },
    Webhook(
      variables: WebhookQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: WebhookQuery
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<WebhookQuery>(WebhookDocumentString, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        "Webhook",
        "query",
        variables,
      )
    },
    RemoveWebhooks(
      variables: RemoveWebhooksMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: RemoveWebhooksMutation
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<RemoveWebhooksMutation>(
            RemoveWebhooksDocumentString,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders },
          ),
        "RemoveWebhooks",
        "mutation",
        variables,
      )
    },
    UpdateWebhook(
      variables: UpdateWebhookMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<{
      data: UpdateWebhookMutation
      errors?: GraphQLError[]
      extensions?: any
      headers: Headers
      status: number
    }> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.rawRequest<UpdateWebhookMutation>(
            UpdateWebhookDocumentString,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders },
          ),
        "UpdateWebhook",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
