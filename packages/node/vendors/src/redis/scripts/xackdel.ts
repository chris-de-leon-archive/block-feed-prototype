import { Result } from "ioredis"

// https://github.com/redis/ioredis/blob/ec42c82ceab1957db00c5175dfe37348f1856a93/examples/typescript/scripts.ts#L12
declare module "ioredis" {
  interface RedisCommander<Context> {
    xackdel(
      streamName: string,
      consumerGroupName: string,
      ...msgIDs: string[]
    ): Result<string, Context>
  }
}

export const xackdel = {
  numberOfKeys: 2,
  lua: `
    local stream_key = KEYS[1]
    local consumer_group_key = KEYS[2]
    redis.call("XACK", stream_key, consumer_group_key, unpack(ARGV))
    redis.call("XDEL", stream_key, unpack(ARGV))
  `,
}
