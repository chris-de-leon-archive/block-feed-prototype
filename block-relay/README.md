# Block Feed Relayer

## Design Goal:

In this design, we want to create a lightweight service that queries blocks from a particular blockchain and consumes them in near real time. The service should be fault-tolerant meaning that in the event of a shut down, it should be able to resume the work it was doing as soon as it comes online again. It should also ensure the time starting from when the block arrives to when it is delivered is minimized. Blocks should be delivered in the order in which they arrive, and should be delivered to the client at least once.

## Design Notes:

In this design, we chose redis over rabbit mq for several reasons:

1. rabbit mq doesn't have the same low-latency advantages that redis does

1. rabbit mq transactions are scoped to individual queues as opposed to the whole connection

1. rabbit mq doesn't have as much support as redis when it comes to performing atomic operations on a single integer value (such as incrementing a block height in our example)

We also considered not using a third party service at all, but this wouldn't allow the service to survive restarts and ultimately led to an atomicity issues between block height updates and block processing completion.
