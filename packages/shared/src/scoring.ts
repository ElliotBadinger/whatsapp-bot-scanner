import { isSuspiciousTld } from './url';
import type { GsbThreatMatch } from './reputation/gsb';

export interface Signals {
  gsbHit?: boolean;
  gsbMatches?: GsbThreatMatch[];
  phishtankHit?: boolean;
  urlhausListed?: boolean;
  vt?: { malicious: number; suspicious: number; harmless: number };
  domainAgeDays?: number;
  excessiveRedirects?: boolean;
  ipLiteral?: boolean;
  uncommonPort?: boolean;
  executableDownload?: boolean;
  homographRisk?: boolean;
  shortener?: boolean;
  suspiciousTld?: boolean;
}

export function scoreFromSignals(signals: Signals): { verdict: 'benign'|'suspicious'|'malicious'; score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (signals.gsbHit) { score += 80; reasons.push('Google Safe Browsing match'); }
  if (signals.vt && (signals.vt.malicious > 0 || signals.vt.suspicious > 3)) { score += 50; reasons.push(`VirusTotal engines flagged: ${signals.vt.malicious}/${(signals.vt.malicious||0)+(signals.vt.harmless||0)}`); }
  if (signals.domainAgeDays !== undefined && signals.domainAgeDays < 14) { score += 30; reasons.push(`New domain (${signals.domainAgeDays} days)`); }
  if (signals.excessiveRedirects) { score += 10; reasons.push('Excessive redirects'); }
  if (signals.ipLiteral) { score += 25; reasons.push('IP-literal URL'); }
  if (signals.uncommonPort) { score += 10; reasons.push('Uncommon port'); }
  if (signals.executableDownload) { score += 60; reasons.push('Executable download'); }
  if (signals.homographRisk) { score += 15; reasons.push('IDN/homograph risk'); }
  if (signals.shortener) { score += 10; reasons.push('URL shortener'); }
  if (signals.suspiciousTld) { score += 10; reasons.push('Suspicious TLD'); }

  let verdict: 'benign'|'suspicious'|'malicious' = 'benign';
  if (score >= 70) verdict = 'malicious';
  else if (score >= 30) verdict = 'suspicious';
  return { verdict, score, reasons };
}

export function extraHeuristics(u: URL): Partial<Signals> {
  const port = u.port ? parseInt(u.port, 10) : (u.protocol === 'http:' ? 80 : 443);
  const uncommonPort = ![80,443].includes(port);
  const ipLiteral = /^(\d+\.\d+\.\d+\.\d+|\[[0-9a-fA-F:]+\])$/.test(u.hostname);
  const executableDownload = /\.(exe|msi|apk|bat|cmd|ps1|scr|jar|pkg|dmg|iso)$/i.test(u.pathname);
  const suspiciousTld = isSuspiciousTld(u.hostname);
  const homographRisk = /xn--/.test(u.hostname);
  return { uncommonPort, ipLiteral, executableDownload, suspiciousTld, homographRisk };
}
