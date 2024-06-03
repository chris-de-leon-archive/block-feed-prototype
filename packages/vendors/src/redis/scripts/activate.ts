import { Result } from "ioredis"

// https://github.com/redis/ioredis/blob/ec42c82ceab1957db00c5175dfe37348f1856a93/examples/typescript/scripts.ts#L12
declare module "ioredis" {
  interface RedisCommander<Context> {
    activate(
      webhookSetKey: string,
      pendingSetKey: string,
      ...argv: string[]
    ): Result<string, Context>
  }
}

// Script Breakdown:
//
// Keys:
//   1 = key of webhook set
//   2 = key of pending set
//
// ARGV:
//   A list of webhook IDs
//
// Algorithm:
//   1. First, we check which webhook IDs have already been activated and which ones haven't
//   2. For all the webhooks that HAVE NOT been activated, we'll create a JSON job object for it and add the job to a lua table
//   3. All input webhook IDs in ARGV are added to the webhook set (so that they cannot be activated again)
//   4. The contents of the lua table containing the jobs is unpacked and added to the pending set for later processing
//
export const activate = {
  numberOfKeys: 2,
  lua: `
    local webhook_set_key = KEYS[1]
    local pending_set_key = KEYS[2]

    local exists = redis.call("SMISMEMBER", webhook_set_key, unpack(ARGV))
    
    local jobs = {}
    for i = 1, #ARGV do
      if exists[i] == 0 then 
        table.insert(jobs, 0)
        table.insert(jobs, 
          cjson.encode({ 
            ['WebhookID'] = ARGV[i], 
            ['BlockHeight'] = 0,
            ['IsNew'] = true,
          })
        )
      end
    end

    redis.call("SADD", webhook_set_key, unpack(ARGV))
    redis.call("ZADD", pending_set_key, unpack(jobs))
  `,
}
