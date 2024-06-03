# Overview

## Testing

### All Tests

You can run all tests using:

```sh
pnpm test:all
```

### Integration Tests

You can run a specific integration test using:

```sh
pnpm test:int:one blockstore/timescale
pnpm test:int:one blockstore/mongo
pnpm test:int:one blockstore/redis
```

### E2E Tests

You can run a specific end-to-end test using:

```sh
pnpm test:e2e:one basic
pnpm test:e2e:one load
```
