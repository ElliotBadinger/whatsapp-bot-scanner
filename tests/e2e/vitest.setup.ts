import { mkdirSync } from 'node:fs';

process.env.URLSCAN_CALLBACK_SECRET = process.env.URLSCAN_CALLBACK_SECRET || 'test-secret';
process.env.CONTROL_PLANE_API_TOKEN = process.env.CONTROL_PLANE_API_TOKEN || 'test-token';
process.env.VT_API_KEY = process.env.VT_API_KEY || 'test-vt-key';
process.env.WHOISXML_API_KEY = process.env.WHOISXML_API_KEY || 'test-whois-key';

mkdirSync('storage/urlscan-artifacts', { recursive: true });
