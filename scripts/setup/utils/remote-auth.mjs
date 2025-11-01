import { cleanDigits } from './runtime.mjs';

function ensureRemoteAuthState(runtime) {
  if (!runtime.remoteAuthState) {
    runtime.remoteAuthState = {
      lastQrAt: 0,
      lastHintAt: 0,
      lastCode: null
    };
  }
  return runtime.remoteAuthState;
}

function shouldThrottle(state, key, intervalMs) {
  const now = Date.now();
  if (now - state[key] < intervalMs) return true;
  state[key] = now;
  return false;
}

export function announcePairingCode(context, output, runtime, { code, attempt, phone }) {
  const state = ensureRemoteAuthState(runtime);
  if (state.lastCode === code) return;
  state.lastCode = code;
  output.heading('Phone Number Pairing Code');
  output.success(`Code: ${code}`);
  if (Number.isFinite(attempt)) {
    output.info(`Attempt: ${attempt}`);
  }
  if (phone) {
    output.info(`Phone: ${phone}`);
  }
  context.log('remoteAuthCode', { code, attempt, phone });
}

export function handleRemoteAuthLog(context, runtime, output, event) {
  const state = ensureRemoteAuthState(runtime);
  const message = event.msg || '';
  if (/Using raw RemoteAuth data key/i.test(message)) {
    output.note('Detected RemoteAuth data key in environment. Ensure device secrets stay secure.');
    return;
  }
  if (/Initialising RemoteAuth strategy/i.test(message)) {
    output.info('Initialising RemoteAuth session…');
    return;
  }
  if (/Auto pairing enabled/i.test(message)) {
    if (!shouldThrottle(state, 'lastHintAt', 5_000)) {
      output.info('Auto pairing enabled; keep WhatsApp open on the target device.');
    }
    return;
  }
  if (/RemoteAuth session not found/i.test(message)) {
    if (!shouldThrottle(state, 'lastHintAt', 5_000)) {
      output.info('No existing RemoteAuth session found. Waiting for the phone-number pairing code.');
    }
    return;
  }
  if (/QR code generated/i.test(message)) {
    if (!shouldThrottle(state, 'lastQrAt', 30_000)) {
      output.warn('QR code suppressed while phone-number pairing is in progress. Disable auto pairing if you prefer the QR flow.');
    }
    return;
  }
  if (/Requested phone-number pairing code/i.test(message) && event.code) {
    announcePairingCode(context, output, runtime, {
      code: event.code,
      attempt: event.attempt,
      phone: event.phoneNumber
    });
    return;
  }
  if (/WhatsApp client ready/i.test(message)) {
    output.success('WhatsApp client reports ready.');
    return;
  }
  output.note(message);
}

export function handleRemoteAuthLine(context, runtime, output, line) {
  const state = ensureRemoteAuthState(runtime);
  if (/WhatsApp pairing code for/i.test(line)) {
    const codeMatch = line.match(/code for .*?:\s*([A-Z0-9]{6,8})/i);
    const phoneMatch = line.match(/for\s+(\*+[\dA-Z]+)/i);
    if (codeMatch) {
      announcePairingCode(context, output, runtime, {
        code: codeMatch[1].toUpperCase(),
        attempt: null,
        phone: phoneMatch ? phoneMatch[1] : null
      });
      return true;
    }
  }
  if (/Open WhatsApp > Linked Devices/i.test(line)) {
    if (!shouldThrottle(state, 'lastHintAt', 5_000)) {
      output.info('Open WhatsApp → Linked Devices → follow the on-screen prompt to finish linking.');
    }
    return true;
  }
  if (/QR code ready for scanning/i.test(line)) {
    if (!shouldThrottle(state, 'lastQrAt', 30_000)) {
      output.warn('QR code available for scanning. If you expected phone-number pairing, wait for the SMS or disable auto pairing.');
    }
    return true;
  }
  return false;
}

export function parseRemoteAuthPhone(runtime) {
  const state = ensureRemoteAuthState(runtime);
  if (!runtime.envFile) return null;
  const phone = runtime.envFile.get('WA_REMOTE_AUTH_PHONE_NUMBER');
  return cleanDigits(phone || state.lastPhone || '');
}
