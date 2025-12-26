import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request } from 'undici';

// This E2E test assumes the full stack is running (e.g. via `make up`)
// It interacts with the system via the Control Plane API and checks results.
// If the stack is not running, these tests will fail or should be skipped.

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'http://localhost:3000';
const API_TOKEN = process.env.CONTROL_PLANE_API_TOKEN || 'dev-token';

describe('End-to-End System Flow', () => {
  // Skip if we can't reach the control plane
  let isReachable = false;

  beforeAll(async () => {
    try {
      const { statusCode } = await request(`${CONTROL_PLANE_URL}/health`, {
        method: 'GET',
      });
      if (statusCode === 200) {
        isReachable = true;
      }
    } catch (e) {
      console.warn('Control plane not reachable, skipping E2E tests');
    }
  });

  it('should scan a URL and return a verdict', async () => {
    if (!isReachable) {
      console.log('Skipping test: Control plane unreachable');
      return;
    }

    // 1. Submit a scan request
    const scanUrl = 'http://example.com';
    const { statusCode, body } = await request(`${CONTROL_PLANE_URL}/api/v1/scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: scanUrl }),
    });

    expect(statusCode).toBe(202);
    const response = await body.json() as { id: string };
    expect(response.id).toBeDefined();
    const scanId = response.id;

    // 2. Poll for results
    let status = 'pending';
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (status === 'pending' && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000));
      
      const { statusCode: pollStatus, body: pollBody } = await request(`${CONTROL_PLANE_URL}/api/v1/scan/${scanId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
        },
      });

      expect(pollStatus).toBe(200);
      const pollResult = await pollBody.json() as { status: string; verdict?: string };
      status = pollResult.status;
      
      if (status === 'completed') {
        expect(pollResult.verdict).toBeDefined();
        // example.com should be benign
        expect(pollResult.verdict).toBe('benign');
      }
      
      attempts++;
    }

    expect(status).toBe('completed');
  }, 35000); // Increased timeout
});