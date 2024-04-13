import { Redis, Result } from "ioredis"
import { z } from "zod"

// https://github.com/redis/ioredis/blob/ec42c82ceab1957db00c5175dfe37348f1856a93/examples/typescript/scripts.ts#L12
declare module "ioredis" {
  interface RedisCommander<Context> {
    xaddbatch(
      streamName: string,
      dataField: string,
      ...argv: string[]
    ): Result<string, Context>
  }
}

export type RedisVendor = ReturnType<typeof create>

export const zEnv = z.object({
  REDIS_WEBHOOK_STREAM_NAME: z.string().min(1),
  REDIS_URL: z.string().url().optional(),
})

export const create = (env: z.infer<typeof zEnv>) => {
  if (env.REDIS_URL == null) {
    throw new Error("REDIS_URL is not defined")
  }

  const client = new Redis(env.REDIS_URL, {
    scripts: {
      xaddbatch: {
        numberOfKeys: 2,
        lua: `
          for i = 1, #ARGV do
            redis.call('XADD', KEYS[1], '*', KEYS[2], ARGV[i])
          end 
        `,
      },
    },
  })

  return {
    client,
    env,
  }
}
