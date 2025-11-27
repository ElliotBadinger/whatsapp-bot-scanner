#!/usr/bin/env ts-node
/*
 * Synthetic Dataset & Replay Script for WhatsApp Scanner
 *
 * Usage:
 *   CONTROL_PLANE_URL=http://localhost:8080 \
 *   CONTROL_PLANE_API_TOKEN=dev-token \
 *   ts-node scripts/replay-test-messages.ts
 */

import { request } from 'undici';

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'http://localhost:8080';
const API_TOKEN = process.env.CONTROL_PLANE_API_TOKEN || 'dev-token';

interface TestMessage {
  url: string;
  expectedVerdict?: 'benign' | 'suspicious' | 'malicious';
  description: string;
}

const DATASET: TestMessage[] = [
  {
    url: 'https://google.com',
    expectedVerdict: 'benign',
    description: 'Safe popular domain',
  },
  {
    url: 'http://testsafebrowsing.appspot.com/s/malware.html',
    expectedVerdict: 'malicious',
    description: 'GSB Malware Test',
  },
  {
    url: 'http://testsafebrowsing.appspot.com/s/phishing.html',
    expectedVerdict: 'malicious',
    description: 'GSB Phishing Test',
  },
  {
    url: 'https://www.wikipedia.org',
    expectedVerdict: 'benign',
    description: 'Safe encyclopedia',
  },
  {
    url: 'http://example.com',
    expectedVerdict: 'benign',
    description: 'Example domain',
  },
  // Add more synthetic cases here
];

async function submitScan(url: string): Promise<{ ok: boolean; urlHash?: string; jobId?: string; error?: string }> {
  try {
    const res = await request(`${CONTROL_PLANE_URL}/rescan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ url }),
    });

    if (res.statusCode !== 200) {
      return { ok: false, error: `HTTP ${res.statusCode}` };
    }

    const data = await res.body.json() as { ok: boolean; urlHash?: string; jobId?: string; error?: string };
    return data;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function main() {
  console.log(`Starting replay against ${CONTROL_PLANE_URL}`);
  console.log(`Dataset size: ${DATASET.length} URLs`);

  let success = 0;
  let failed = 0;

  for (const item of DATASET) {
    console.log(`\nSubmitting: ${item.url} (${item.description})`);
    const result = await submitScan(item.url);

    if (result.ok) {
      console.log(`  ✅ Queued: Hash=${result.urlHash}, Job=${result.jobId}`);
      success++;
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
      failed++;
    }

    // Small delay to avoid overwhelming local dev stack if running sequentially
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('\n=== Replay Summary ===');
  console.log(`Total: ${DATASET.length}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Replay script failed:', err);
  process.exit(1);
});