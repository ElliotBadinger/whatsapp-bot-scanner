import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const ROOT_DIR = path.resolve(path.dirname(SCRIPT_PATH), '..', '..');
export const ENV_PATH = path.join(ROOT_DIR, '.env');
export const ENV_TEMPLATE_PATH = path.join(ROOT_DIR, '.env.example');

export const HTTP_HEALTH_TARGETS = [
  { name: 'Reverse proxy', envPort: 'REVERSE_PROXY_PORT', defaultPort: 8088, path: '/healthz', requiresToken: true },
  { name: 'Control plane (via reverse proxy)', envPort: 'REVERSE_PROXY_PORT', defaultPort: 8088, path: '/healthz', requiresToken: true }
];

export const TROUBLESHOOTING_LINES = [
  'Missing API keys: re-run ./setup.sh without --noninteractive or edit .env directly.',
  'Queue naming errors: queue names should contain letters, numbers, or hyphens only.',
  'WhatsApp login stuck: docker compose logs wa-client and unlink previous device sessions.',
  'Port in use: adjust REVERSE_PROXY_PORT or CONTROL_PLANE_PORT inside .env, then rerun ./setup.sh --clean.',
  'Unexpected crashes: inspect docker compose logs <service> and node scripts/validate-config.js.'
];

export const DEFAULT_REMOTE_AUTH_PHONE = 'REDACTED_PHONE_NUMBER';

export const API_INTEGRATIONS = [
  {
    key: 'VT_API_KEY',
    flag: null,
    title: 'VirusTotal',
    importance: 'recommended',
    docs: 'Improves verdict accuracy for URL scanning.'
  },
  {
    key: 'GSB_API_KEY',
    flag: null,
    title: 'Google Safe Browsing',
    importance: 'recommended',
    docs: 'Adds Google Safe Browsing verdicts; ensure billing is enabled for production use.'
  },
  {
    key: 'URLSCAN_API_KEY',
    flag: 'URLSCAN_ENABLED',
    title: 'urlscan.io',
    importance: 'recommended',
    docs: 'Enables rich urlscan.io submissions; free tier allows ~50 scans/day.'
  },
  {
    key: 'WHOISXML_API_KEY',
    flag: null,
    title: 'WhoisXML',
    importance: 'optional',
    docs: 'Improves WHOIS enrichment; paid tiers recommended for sustained usage.'
  }
];
