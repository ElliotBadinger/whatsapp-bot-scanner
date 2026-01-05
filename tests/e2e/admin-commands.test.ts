import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAdminCommand } from '../../services/wa-client/src/index';

describe('WA admin command scenarios', () => {
  const originalFetch = global.fetch;
  const chat = {
    sendMessage: vi.fn(),
    id: { _serialized: 'group-1' },
    isGroup: true,
    participants: [
      { id: { _serialized: 'admin' }, isAdmin: true, isSuperAdmin: false },
    ],
  } as any;

  const buildMessage = (body: string) => ({
    body,
    author: 'admin',
    from: 'admin',
    getChat: async () => chat,
    getContact: async () => ({ id: { _serialized: 'admin' } }),
  } as any);

  beforeEach(() => {
    process.env.CONTROL_PLANE_BASE = 'http://control-plane:8080';
    chat.sendMessage.mockReset();
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      // @ts-expect-error ensure fetch removed if undefined originally
      delete global.fetch;
    }
  });

  it('handles mute, unmute, status, and rescan commands', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ scans: 10, malicious: 2 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, urlHash: 'hash123', jobId: 'job-1' }),
      });

    global.fetch = fetchMock as any;

    await handleAdminCommand({} as any, buildMessage('!scanner mute'));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mute'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(chat.sendMessage).toHaveBeenLastCalledWith('Scanner muted for 60 minutes.');

    await handleAdminCommand({} as any, buildMessage('!scanner unmute'));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/unmute'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(chat.sendMessage).toHaveBeenLastCalledWith('Scanner unmuted.');

    await handleAdminCommand({} as any, buildMessage('!scanner status'));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/status'),
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(chat.sendMessage).toHaveBeenLastCalledWith('Scanner status: scans=10, malicious=2');

    await handleAdminCommand({} as any, buildMessage('!scanner rescan http://example.com'));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rescan'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(chat.sendMessage).toHaveBeenLastCalledWith('Rescan queued. hash=hash123 job=job-1');
  });
});
