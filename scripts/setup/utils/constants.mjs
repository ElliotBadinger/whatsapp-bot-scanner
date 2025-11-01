export const REQUIRED_COMMANDS = [
  { name: 'docker', hint: 'Install instructions: https://docs.docker.com/engine/install/' },
  { name: 'make', hint: 'Install via your package manager (e.g. brew install make).' },
  { name: 'curl', hint: 'Install via https://curl.se/download.html' },
  { name: 'sed', hint: 'Install via GNU sed package.' },
  { name: 'awk', hint: 'Install via GNU awk (gawk).' },
  { name: 'openssl', hint: 'Install via OpenSSL binary package.' }
];

export const PORT_CHECKS = [
  { port: 8088, label: 'Reverse proxy', envHint: 'REVERSE_PROXY_PORT' },
  { port: 8080, label: 'Control plane', envHint: 'CONTROL_PLANE_PORT' },
  { port: 3002, label: 'Grafana', envHint: 'GRAFANA_PORT' },
  { port: 3000, label: 'WA client (internal)', envHint: null }
];

export const WAIT_FOR_SERVICES = [
  { service: 'postgres', label: 'Postgres' },
  { service: 'redis', label: 'Redis' },
  { service: 'scan-orchestrator', label: 'Scan orchestrator' },
  { service: 'control-plane', label: 'Control plane' }
];
