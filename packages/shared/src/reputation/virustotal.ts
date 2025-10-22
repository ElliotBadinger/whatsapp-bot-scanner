import { request } from 'undici';
import { config } from '../config';

export interface VirusTotalAnalysis {
  data?: any;
  latencyMs?: number;
  disabled?: boolean;
}

export async function vtAnalyzeUrl(url: string): Promise<VirusTotalAnalysis> {
  if (!config.vt.apiKey) return { disabled: true };
  const submit = await request('https://www.virustotal.com/api/v3/urls', {
    method: 'POST',
    headers: {
      'x-apikey': config.vt.apiKey,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ url }).toString()
  });
  if (submit.statusCode === 429) {
    const err = new Error('VirusTotal quota exceeded');
    (err as any).code = 429;
    throw err;
  }
  if (submit.statusCode >= 400) {
    const err = new Error(`VirusTotal submission failed: ${submit.statusCode}`);
    (err as any).statusCode = submit.statusCode;
    throw err;
  }
  const body: any = await submit.body.json();
  const analysisId = body.data?.id;
  const started = Date.now();
  let analysis: any;
  while (Date.now() - started < 50000) {
    const res = await request(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
      headers: { 'x-apikey': config.vt.apiKey }
    });
    if (res.statusCode === 429) {
      const err = new Error('VirusTotal quota exceeded');
      (err as any).code = 429;
      throw err;
    }
    if (res.statusCode >= 500) {
      const err = new Error(`VirusTotal analysis failed: ${res.statusCode}`);
      (err as any).statusCode = res.statusCode;
      throw err;
    }
    analysis = await res.body.json();
    const status = analysis.data?.attributes?.status;
    if (status !== 'queued') break;
    await new Promise(r => setTimeout(r, 2000));
  }
  return { data: analysis, latencyMs: Date.now() - started };
}

export function vtVerdictStats(analysis: VirusTotalAnalysis | any): { malicious: number; suspicious: number; harmless: number } | undefined {
  if (analysis?.disabled) return undefined;
  const st = analysis?.data?.data?.attributes?.stats ?? analysis?.data?.attributes?.stats;
  if (!st) return undefined;
  return {
    malicious: st.malicious || 0,
    suspicious: st.suspicious || 0,
    harmless: st.harmless || 0
  };
}
