import { fetchWithTimeout } from '../utils/network.mjs';
import { API_INTEGRATIONS } from '../config.mjs';

function recordMissingKey(context, runtime, message) {
  runtime.missingKeys.push(message);
  context.log('missingKey', { message });
}

function recordDisabledFeature(context, runtime, message) {
  runtime.disabledFeatures.push(message);
  context.log('disabledFeature', { message });
}

async function validateVirusTotal({ context, runtime, output }) {
  const env = runtime.envFile;
  const key = env.get('VT_API_KEY');
  if (!key) {
    recordMissingKey(context, runtime, 'VirusTotal disabled without VT_API_KEY.');
    output.warn('VT_API_KEY not set. VirusTotal checks will be skipped.');
    return;
  }
  try {
    const res = await fetchWithTimeout('https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8', {
      headers: { 'x-apikey': key }
    });
    if (res.status === 200) {
      output.success('VirusTotal API key accepted.');
    } else if (res.status === 401 || res.status === 403) {
      throw new Error(`VirusTotal API key rejected (HTTP ${res.status}). Update VT_API_KEY and rerun.`);
    } else {
      output.warn(`VirusTotal validation returned HTTP ${res.status}. Check quota or network.`);
    }
  } catch (error) {
    output.warn(`VirusTotal validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function validateGoogleSafeBrowsing({ context, runtime, output }) {
  const env = runtime.envFile;
  const key = env.get('GSB_API_KEY');
  if (!key) {
    recordMissingKey(context, runtime, 'Google Safe Browsing disabled without GSB_API_KEY.');
    output.warn('GSB_API_KEY not set. Google Safe Browsing will be disabled.');
    return;
  }
  try {
    const res = await fetchWithTimeout(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'wbscanner-setup', clientVersion: '2.0' },
          threatInfo: {
            threatTypes: ['MALWARE'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url: 'https://example.com' }]
          }
        })
      }
    );
    if (res.status === 200) {
      output.success('Google Safe Browsing API key accepted.');
    } else if ([400, 401, 403].includes(res.status)) {
      const body = await res.text();
      throw new Error(`GSB API key rejected (HTTP ${res.status}). Response: ${body.slice(0, 120)}`);
    } else {
      output.warn(`GSB validation returned HTTP ${res.status}. Check billing or quota.`);
    }
  } catch (error) {
    output.warn(`GSB validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function validateUrlscan({ context, runtime, output }) {
  const env = runtime.envFile;
  const enabled = (env.get('URLSCAN_ENABLED') || 'false').toLowerCase() === 'true';
  const key = env.get('URLSCAN_API_KEY');
  if (!enabled) return;
  if (!key) {
    env.set('URLSCAN_ENABLED', 'false');
    recordDisabledFeature(context, runtime, 'urlscan.io disabled until API key provided.');
    recordMissingKey(context, runtime, 'urlscan.io deep scans unavailable without URLSCAN_API_KEY.');
    return;
  }
  try {
    const res = await fetchWithTimeout('https://urlscan.io/user/quotas', {
      headers: { 'API-Key': key }
    });
    if (res.status === 200) {
      output.success('urlscan.io API key accepted.');
    } else if (res.status === 401 || res.status === 403) {
      env.set('URLSCAN_ENABLED', 'false');
      env.set('URLSCAN_CALLBACK_SECRET', '');
      recordDisabledFeature(context, runtime, 'urlscan.io disabled: API key rejected.');
      recordMissingKey(context, runtime, 'urlscan.io unavailable until a valid key is provided.');
    } else {
      output.warn(`urlscan.io validation returned HTTP ${res.status}.`);
    }
  } catch (error) {
    output.warn(`urlscan.io validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function validateWhoisXml({ context, runtime, output }) {
  const env = runtime.envFile;
  const enabled = (env.get('WHOISXML_ENABLED') || 'false').toLowerCase() === 'true';
  const key = env.get('WHOISXML_API_KEY');
  if (!enabled || !key) return;
  try {
    const res = await fetchWithTimeout(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${key}&domainName=example.com&outputFormat=JSON`
    );
    if (res.status === 200) {
      const body = await res.text();
      if (/ErrorMessage/i.test(body)) {
        output.warn('WhoisXML responded with an error message; check quota.');
      } else {
        output.success('WhoisXML API key accepted.');
      }
    } else if (res.status === 401 || res.status === 403) {
      env.set('WHOISXML_ENABLED', 'false');
      recordDisabledFeature(context, runtime, 'WhoisXML disabled: API key rejected.');
    } else {
      output.warn(`WhoisXML validation returned HTTP ${res.status}.`);
    }
  } catch (error) {
    output.warn(`WhoisXML validation failed: ${(error && error.message) || 'network error'}.`);
  }
}

async function notePhishTank({ runtime, output }) {
  const env = runtime.envFile;
  const phishKey = env.get('PHISHTANK_APP_KEY');
  if (phishKey) {
    output.info('PhishTank key present; API currently rate-limited—perform manual verification later.');
  } else {
    output.warn('PhishTank APP key missing (registration currently limited); continuing without it.');
  }
}

export default {
  id: 'api-validation',
  title: 'Validate API integrations',
  prerequisites: ['config-validation'],
  copy: {
    guided: {
      description: 'Sanity check third-party integrations to surface missing or invalid credentials early.'
    },
    expert: {
      description: 'Performs lightweight API probes and records missing keys for follow-up.'
    }
  },
  async run({ context, runtime, output }) {
    output.heading('Validating API keys');
    await Promise.all([
      validateVirusTotal({ context, runtime, output }),
      validateGoogleSafeBrowsing({ context, runtime, output }),
      validateUrlscan({ context, runtime, output }),
      validateWhoisXml({ context, runtime, output }),
      notePhishTank({ runtime, output })
    ]);
    await runtime.envFile.save();
    output.success('API key validation complete.');
    if (!context.flags.noninteractive) {
      const optional = API_INTEGRATIONS.filter(item => item.importance === 'optional');
      if (optional.length) {
        output.note('Optional integrations can be configured later via ./setup.sh.');
      }
    }
  }
};
