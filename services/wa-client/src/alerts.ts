import type { Logger } from 'pino';

interface AuthFailureAlert {
  clientId: string;
  count: number;
  lastMessage?: string;
}

export async function sendAuthFailureAlert(logger: Logger, payload: AuthFailureAlert): Promise<void> {
  const webhook = process.env.WA_ALERT_WEBHOOK_URL;
  const text = `wa-client auth failures for ${payload.clientId}: ${payload.count} consecutive errors. Last message: ${payload.lastMessage ?? 'n/a'}`;
  if (!webhook) {
    logger.warn({ payload }, 'WA_ALERT_WEBHOOK_URL not configured; skipping external auth-failure alert');
    return;
  }
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body }, 'Failed to send auth failure alert');
    }
  } catch (err) {
    logger.error({ err }, 'Error sending auth failure alert');
  }
}
