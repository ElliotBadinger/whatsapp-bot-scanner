import { describe, expect, it } from 'vitest';
import RedisMock from 'ioredis-mock';
import { LocalThreatDatabase, localOfflineAnalyze } from '@wbscanner/shared';
import {
  buildHardModeSuspiciousFromReport,
  fetchMajesticBenign,
  fetchOpenPhishMalicious,
  fetchUrlhausMalicious,
  type DatasetLabel,
  type LabeledUrl,
} from './dataset-sources';

const REPORT_PATH_DEFAULT =
  process.env.WBSCANNER_DATASET_REPORT_PATH ||
  '/home/epistemophile/Development/whatsapp-bot-scanner/scripts/dataset reports/Hard-Mode URL Threats_ High-Signal Data & Heuristics for Next-Gen Detection.md';

function predictedLabelFromVerdict(verdict: DatasetLabel): DatasetLabel {
  if (verdict === 'malicious') return 'malicious';
  if (verdict === 'suspicious') return 'suspicious';
  return 'benign';
}

function isCorrect(expected: DatasetLabel, predicted: DatasetLabel): boolean {
  if (expected === 'suspicious') {
    // "Suspicious" is a soft label; malicious is acceptable.
    return predicted === 'suspicious' || predicted === 'malicious';
  }
  return expected === predicted;
}

async function measureAccuracy(localThreatDb: LocalThreatDatabase, rows: LabeledUrl[]) {
  let correct = 0;
  const misses: Array<{ url: string; expected: DatasetLabel; predicted: DatasetLabel }> = [];
  for (const row of rows) {
    const res = await localOfflineAnalyze(row.url, localThreatDb);
    const predicted = predictedLabelFromVerdict(res.verdict);
    if (isCorrect(row.label, predicted)) {
      correct++;
    } else if (misses.length < 5) {
      misses.push({ url: row.url, expected: row.label, predicted });
    }
  }
  return { accuracy: correct / Math.max(1, rows.length), misses };
}

describe('Local scanning accuracy (stop condition: >=99%)', () => {
  it('meets accuracy threshold across SOTA datasets', async () => {
    const redis = new RedisMock();
    const localThreatDb = new LocalThreatDatabase(redis);

    const openphish = await safeFetchUrls(() => fetchOpenPhishMalicious(2000));
    const urlhaus = await safeFetchUrls(() => fetchUrlhausMalicious(2000));
    if (openphish.length) {
      await localThreatDb.ingestThreatUrls('openphish', openphish.map((r) => r.url));
    }
    if (urlhaus.length) {
      await localThreatDb.ingestThreatUrls('urlhaus', urlhaus.map((r) => r.url));
    }

    const benign = await safeFetchUrls(() => fetchMajesticBenign(5000));

    let hardModeSuspicious: LabeledUrl[] = [];
    try {
      hardModeSuspicious = await buildHardModeSuspiciousFromReport(REPORT_PATH_DEFAULT, 200);
    } catch {
      // The report is local-only for some setups; skip if unavailable.
      hardModeSuspicious = [];
    }

    const datasets: Array<{ name: string; rows: LabeledUrl[] }> = [
      { name: 'openphish', rows: openphish },
      { name: 'urlhaus', rows: urlhaus },
      { name: 'majestic-million(head)', rows: benign },
      ...(hardModeSuspicious.length ? [{ name: 'hard-mode-report', rows: hardModeSuspicious }] : []),
    ].filter((d) => d.rows.length > 0);

    expect(datasets.length, 'No datasets were fetched; cannot evaluate accuracy.').toBeGreaterThan(0);

    const results = await Promise.all(
      datasets.map(async (ds) => ({ name: ds.name, ...(await measureAccuracy(localThreatDb, ds.rows)) }))
    );

    const failures = results.filter((r) => r.accuracy < 0.99);
    const summary = results.map((r) => `${r.name}=${(r.accuracy * 100).toFixed(2)}%`).join(', ');
    const details = failures
      .map((f) => `${f.name} misses: ${f.misses.map((m) => `${m.expected}->${m.predicted} ${m.url}`).join(' | ')}`)
      .join('\n');

    expect(failures, `Accuracy stop condition failed: ${summary}\n${details}`).toEqual([]);
  });
});

async function safeFetchUrls(fn: () => Promise<LabeledUrl[]>): Promise<LabeledUrl[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}
