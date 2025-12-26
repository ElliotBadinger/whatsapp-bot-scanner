import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";

// Unmock ioredis to use the real Redis instance
vi.unmock("ioredis");

describe("Pipeline Integration", () => {
  let redis: Redis;
  let queue: Queue;
  let worker: Worker;
  const queueName = `test-queue-${uuidv4()}`;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });

    queue = new Queue(queueName, { connection: redis });
  });

  afterAll(async () => {
    await queue.close();
    if (worker) await worker.close();
    await redis.quit();
  });

  it("should process a job through the queue", async () => {
    const jobId = uuidv4();
    const jobData = { url: "https://example.com", scanId: jobId };

    // Add job to queue
    await queue.add("scan", jobData);

    // Create a worker to process it
    let processedJobId: string | undefined;
    let processedData: any;

    worker = new Worker(
      queueName,
      async (job) => {
        processedJobId = job.id;
        processedData = job.data;
        return { result: "ok" };
      },
      { connection: redis },
    );

    // Wait for job to be processed
    await new Promise<void>((resolve, reject) => {
      worker.on("completed", (job) => {
        if (job.id === processedJobId) resolve();
      });
      worker.on("failed", (job, err) => {
        reject(err);
      });
      // Timeout
      setTimeout(() => reject(new Error("Timeout waiting for job")), 5000);
    });

    expect(processedData).toEqual(jobData);

    // Verify job status
    const job = await queue.getJob(processedJobId!);
    expect(job).toBeDefined();
    const state = await job!.getState();
    expect(state).toBe("completed");
  });
});
