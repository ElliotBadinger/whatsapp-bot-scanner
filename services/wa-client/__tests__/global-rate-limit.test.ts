import { describe, expect, it } from "@jest/globals";
import type { Redis } from "ioredis";
import {
  createGlobalTokenBucket,
  GLOBAL_TOKEN_BUCKET_ID,
} from "../src/limiters";

describe("global token bucket limiter", () => {
  it("throttles the 1001st send within an hour", async () => {
    const fakeRedis = {} as unknown as Redis;
    const limiter = createGlobalTokenBucket(
      fakeRedis,
      1000,
      "test_global_token_bucket",
    );

    for (let i = 0; i < 1000; i += 1) {
      await expect(
        limiter.consume(GLOBAL_TOKEN_BUCKET_ID),
      ).resolves.toMatchObject({ remainingPoints: expect.any(Number) });
    }

    await expect(limiter.consume(GLOBAL_TOKEN_BUCKET_ID)).rejects.toBeDefined();
  });
});
