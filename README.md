# Block Feed Prototype

## Intro

The Block Feed project consists of a series of micorservices which make it possible to subscribe to blockchain block data in real time via a webhook subscription. Here are some notable features in this project:

- Webhooks are configurable (you can adjust the number of retries and the URL that the data should be sent to)
- It comes with a product landing page to showcase the prodduct
- It offers a dashboard which makes it easier to manage webhooks
- The web UI is integrated with the Stripe API (the backend still needs to implement metering so that we can bill based on the number of requests)
- The backend can be extended to support both EVM and non-EVM chains
- It uses a redis cluster per chain to process webhooks which allows for more granular horizontal scaling
- The backend services are written using Go/RedisCluster/TimescaleDB/MongoDB
- The web apps are written using NodeJS/Typescript/NextJS/Drizzle/GraphQL-Yoga

## Pitfalls / Lessons Learned

This project mixed a lot of the billing logic with the business logic, which made it more difficult to:

1. provide a self-hosted option to users
1. make this project open-source and have others contribute

One other pitfall is that there is very little room for customizing the 3rd party storage solutions. For example, this project has chosen redis and timescale DB for backend storage, but it would be better if we could give users more freedom over this so that they are not vendor-locked.

Another issue is that The project itself is very cost-heavy and infra-heavy - if we want to support multiple chains, then we need to spawn more infra. It is possible to use 1 redis cluster / timescale DB for everything, but even then this can be a lot of infra to host.

The last issue I'll address relates to webhook latency and idempotency. If a user configures 5 retries for their webhook, then it is possible that they may receive more than this. This can happen if the backend service goes down right after the request is sent but right before it has a chance to officially count the request in redis. Also poor network connections can result in suboptimal delivery times leading to non-realtime behavior.

## Development

Enter a Nix shell with all necessary dev tools available:

```sh
NIXPKGS_ALLOW_UNFREE=1 nix --extra-experimental-features 'flakes' --extra-experimental-features 'nix-command' develop --show-trace --impure ./nix
```

Install dependencies:

```sh
pnpm i
```

Identifying outdated Node dependencies:

```sh
pnpm run deps:node:outdated
```

Upgrade dependencies:

```sh
# Upgrades Node dependencies
pnpm run deps:node:up

# Upgrades Go dependencies
pnpm run deps:go:up
```

Building the code:

```sh
pnpm run build
```

Generating GraphQL and Database ORM code:

```sh
pnpm run codegen
```

Generating Turbo packages and apps:

```sh
# App
pnpm run turbo:app

# Package
pnpm run turbo:pkg
```

Testing:

```sh
# Test Node projects
make test:node

# Test Go projects
make test:go
```

Starting all Services:

```sh
pnpm run dev:init
```

Starting just the UI:

```sh
pnpm run dev:ui
```

Local Deployment:

```sh
# Navigate to the local deployment folder
cd ./deployment/local

# When prompted, use a tag like 1.0.0 or similar
make apply
```
