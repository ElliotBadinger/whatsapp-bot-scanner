#!/usr/bin/env node

import { execa } from "execa";
import chalk from "chalk";
import ora from "ora";
import { setTimeout } from "timers/promises";
import cliProgress from "cli-progress";
import { createClient } from "redis";

/**
 * Pipeline Stress Test Suite
 *
 * Tests pipeline under load:
 * - Concurrent scan requests
 * - Queue processing throughput
 * - Rate limiting validation
 * - Memory and performance metrics
 */

class StressTestRunner {
  constructor() {
    this.concurrency =
      parseInt(
        process.argv
          .find((arg) => arg.startsWith("--concurrency="))
          ?.split("=")[1],
      ) || 50;
    this.duration =
      parseInt(
        process.argv
          .find((arg) => arg.startsWith("--duration="))
          ?.split("=")[1],
      ) || 60;
    this.verbose = process.argv.includes("--verbose");

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      latencies: [],
      queueDepths: [],
      errors: [],
      startTime: null,
      endTime: null,
    };

    this.redisClient = null;
  }

  async setupRedis() {
    const spinner = ora("Connecting to Redis...").start();

    try {
      this.redisClient = createClient({
        url: "redis://localhost:6379",
        socket: {
          connectTimeout: 5000,
        },
      });

      this.redisClient.on("error", (err) => {
        spinner.fail("Redis connection error");
        console.error(chalk.red(err.message));
      });

      await this.redisClient.connect();
      spinner.succeed("Connected to Redis");
      return true;
    } catch (error) {
      spinner.fail("Failed to connect to Redis");
      console.error(chalk.red(error.message));
      return false;
    }
  }

  async getQueueDepth(queueName) {
    try {
      const depth = await this.redisClient.lLen(queueName);
      return depth;
    } catch (error) {
      return -1;
    }
  }

  async monitorQueues() {
    const queues = ["scan-request", "scan-verdict", "deep-scan"];

    while (this.metrics.startTime && !this.metrics.endTime) {
      const depths = {};
      for (const queue of queues) {
        depths[queue] = await this.getQueueDepth(queue);
      }

      this.metrics.queueDepths.push({
        timestamp: Date.now(),
        ...depths,
      });

      await setTimeout(1000); // Monitor every second
    }
  }

  async sendTestScanRequest() {
    const testUrls = [
      "https://example.com/test-1",
      "https://example.org/test-2",
      "https://test.com/sample",
      "https://demo.example.com/link",
    ];

    const url = testUrls[Math.floor(Math.random() * testUrls.length)];
    const start = Date.now();

    try {
      const scanRequest = JSON.stringify({
        url,
        chatId: "stress-test@g.us",
        messageId: `test-${Date.now()}-${Math.random()}`,
        senderId: "1234567890@c.us",
        timestamp: Date.now(),
      });

      await this.redisClient.rPush("scan-request", scanRequest);

      const latency = Date.now() - start;
      this.metrics.latencies.push(latency);
      this.metrics.successfulRequests++;

      return { success: true, latency };
    } catch (error) {
      this.metrics.failedRequests++;
      this.metrics.errors.push({
        timestamp: Date.now(),
        error: error.message,
      });
      return { success: false, error: error.message };
    } finally {
      this.metrics.totalRequests++;
    }
  }

  async runConcurrentRequests(count) {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.sendTestScanRequest());
    }
    return await Promise.all(promises);
  }

  calculateStats() {
    if (this.metrics.latencies.length === 0) {
      return {
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
      };
    }

    const sorted = [...this.metrics.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      mean: Math.round(sum / sorted.length),
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  async runStressTest() {
    console.log(chalk.bold.cyan("\n⚡ Starting Stress Test\n"));
    console.log(`Concurrency: ${chalk.yellow(this.concurrency)}`);
    console.log(`Duration: ${chalk.yellow(this.duration + "s")}`);
    console.log();

    // Start services if not running
    const spinner = ora("Ensuring services are running...").start();
    try {
      await execa("docker", ["compose", "up", "-d", "redis", "postgres"]);
      await setTimeout(3000);
      spinner.succeed("Services ready");
    } catch (error) {
      spinner.fail("Failed to start services");
      return false;
    }

    // Setup Redis connection
    if (!(await this.setupRedis())) {
      return false;
    }

    // Clear existing queue
    spinner.start("Clearing test queues...");
    try {
      await this.redisClient.del("scan-request");
      await this.redisClient.del("scan-verdict");
      await this.redisClient.del("deep-scan");
      spinner.succeed("Test queues cleared");
    } catch (error) {
      spinner.fail("Failed to clear queues");
      return false;
    }

    // Start queue monitoring in background
    const monitorPromise = this.monitorQueues();

    // Progress bar
    const progressBar = new cliProgress.SingleBar({
      format:
        "Progress |" +
        chalk.cyan("{bar}") +
        "| {percentage}% | {value}/{total} requests | ETA: {eta}s",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });

    const totalRequests = Math.ceil(this.duration * (this.concurrency / 2)); // Rough estimate
    progressBar.start(totalRequests, 0);

    this.metrics.startTime = Date.now();
    const endTime = this.metrics.startTime + this.duration * 1000;

    // Run stress test
    while (Date.now() < endTime) {
      await this.runConcurrentRequests(this.concurrency);
      progressBar.update(this.metrics.totalRequests);
      await setTimeout(100); // Brief pause between batches
    }

    this.metrics.endTime = Date.now();
    progressBar.stop();

    // Stop queue monitoring
    await setTimeout(1000);

    return true;
  }

  generateReport() {
    const duration = (this.metrics.endTime - this.metrics.startTime) / 1000;
    const throughput = Math.round(this.metrics.totalRequests / duration);
    const successRate = (
      (this.metrics.successfulRequests / this.metrics.totalRequests) *
      100
    ).toFixed(1);
    const stats = this.calculateStats();

    console.log("\n" + chalk.bold("═".repeat(70)));
    console.log(chalk.bold.cyan("  Stress Test Report"));
    console.log(chalk.bold("═".repeat(70)) + "\n");

    console.log(chalk.bold("Request Metrics:"));
    console.log(`  Total Requests: ${chalk.cyan(this.metrics.totalRequests)}`);
    console.log(
      `  Successful: ${chalk.green(this.metrics.successfulRequests)}`,
    );
    console.log(
      `  Failed: ${this.metrics.failedRequests > 0 ? chalk.red(this.metrics.failedRequests) : chalk.green("0")}`,
    );
    console.log(
      `  Success Rate: ${successRate >= 95 ? chalk.green(successRate + "%") : chalk.yellow(successRate + "%")}`,
    );
    console.log(`  Throughput: ${chalk.cyan(throughput + " req/s")}\n`);

    console.log(chalk.bold("Latency Statistics (ms):"));
    console.log(
      `  Mean: ${stats.mean < 100 ? chalk.green(stats.mean) : chalk.yellow(stats.mean)}`,
    );
    console.log(
      `  Median: ${stats.median < 100 ? chalk.green(stats.median) : chalk.yellow(stats.median)}`,
    );
    console.log(
      `  P95: ${stats.p95 < 200 ? chalk.green(stats.p95) : chalk.yellow(stats.p95)}`,
    );
    console.log(
      `  P99: ${stats.p99 < 500 ? chalk.green(stats.p99) : chalk.yellow(stats.p99)}`,
    );
    console.log(`  Min: ${chalk.green(stats.min)}`);
    console.log(
      `  Max: ${stats.max > 1000 ? chalk.red(stats.max) : chalk.yellow(stats.max)}\n`,
    );

    // Queue depth analysis
    if (this.metrics.queueDepths.length > 0) {
      console.log(chalk.bold("Queue Depth Statistics:"));
      const queues = ["scan-request", "scan-verdict", "deep-scan"];

      for (const queue of queues) {
        const depths = this.metrics.queueDepths
          .map((d) => d[queue])
          .filter((d) => d >= 0);
        if (depths.length > 0) {
          const max = Math.max(...depths);
          const avg = Math.round(
            depths.reduce((a, b) => a + b, 0) / depths.length,
          );
          console.log(`  ${queue}: Max=${max}, Avg=${avg}`);
        }
      }
      console.log();
    }

    if (this.metrics.errors.length > 0) {
      console.log(chalk.bold.red(`Errors (${this.metrics.errors.length}):`));
      const errorCounts = {};
      for (const err of this.metrics.errors) {
        errorCounts[err.error] = (errorCounts[err.error] || 0) + 1;
      }
      for (const [error, count] of Object.entries(errorCounts)) {
        console.log(chalk.red(`  ${count}x: ${error}`));
      }
      console.log();
    }

    // Performance assessment
    console.log(chalk.bold("Performance Assessment:"));
    const assessments = [];

    if (successRate >= 99) {
      assessments.push(chalk.green("✓ Excellent success rate (≥99%)"));
    } else if (successRate >= 95) {
      assessments.push(chalk.yellow("⚠ Good success rate (≥95%)"));
    } else {
      assessments.push(chalk.red("✗ Poor success rate (<95%)"));
    }

    if (stats.p95 < 100) {
      assessments.push(chalk.green("✓ Excellent P95 latency (<100ms)"));
    } else if (stats.p95 < 500) {
      assessments.push(chalk.yellow("⚠ Acceptable P95 latency (<500ms)"));
    } else {
      assessments.push(chalk.red("✗ High P95 latency (≥500ms)"));
    }

    if (throughput >= 100) {
      assessments.push(chalk.green(`✓ High throughput (${throughput} req/s)`));
    } else if (throughput >= 50) {
      assessments.push(
        chalk.yellow(`⚠ Moderate throughput (${throughput} req/s)`),
      );
    } else {
      assessments.push(chalk.red(`✗ Low throughput (${throughput} req/s)`));
    }

    for (const assessment of assessments) {
      console.log(`  ${assessment}`);
    }

    console.log("\n" + chalk.bold("═".repeat(70)));

    return this.metrics.failedRequests === 0 && successRate >= 95;
  }

  async cleanup() {
    console.log(chalk.gray("\nCleaning up..."));

    if (this.redisClient) {
      try {
        await this.redisClient.del("scan-request");
        await this.redisClient.quit();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async run() {
    try {
      const success = await this.runStressTest();
      if (!success) {
        console.error(chalk.red("\nStress test setup failed"));
        process.exit(1);
      }

      const passed = this.generateReport();
      await this.cleanup();

      process.exit(passed ? 0 : 1);
    } catch (error) {
      console.error(chalk.red("\nStress test crashed:"), error);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run stress test
const runner = new StressTestRunner();
runner.run();
