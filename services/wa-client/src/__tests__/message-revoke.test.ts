import { handleSelfMessageRevoke } from '../events/messageRevoke';

describe('handleSelfMessageRevoke', () => {
  const metrics = {
    waMessageRevocations: {
      labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
    },
  };

  const logger = { warn: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records revocation for self messages', async () => {
    const recordRevocation = jest.fn();
    const messageStore = { recordRevocation } as any;

    await handleSelfMessageRevoke({ messageStore, metrics, logger }, {
      fromMe: true,
      to: '123@group',
      id: { _serialized: 'msg-1' },
    } as any);

    expect(recordRevocation).toHaveBeenCalledWith('123@group', 'msg-1', 'me', expect.any(Number));
    expect(metrics.waMessageRevocations.labels).toHaveBeenCalledWith('me');
  });

  it('swallows errors and logs warning', async () => {
    const recordRevocation = jest.fn().mockRejectedValue(new Error('boom'));
    const messageStore = { recordRevocation } as any;

    await handleSelfMessageRevoke({ messageStore, metrics, logger }, {
      fromMe: true,
      to: '123@group',
      id: { _serialized: 'msg-2' },
    } as any);

    expect(logger.warn).toHaveBeenCalled();
  });
});
