import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const metrics = {
  ingestionRate: new client.Counter({
    name: 'wbscanner_messages_ingested_total',
    help: 'Total messages ingested',
    registers: [register],
  }),
  urlsPerMessage: new client.Histogram({
    name: 'wbscanner_urls_per_message',
    help: 'URLs extracted per message',
    buckets: [0,1,2,3,5,8,13],
    registers: [register],
  }),
  scanLatency: new client.Histogram({
    name: 'wbscanner_scan_latency_seconds',
    help: 'End-to-end scan latency',
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [register],
  }),
  cacheHit: new client.Counter({
    name: 'wbscanner_cache_hits_total',
    help: 'Cache hits',
    registers: [register],
  }),
  cacheMiss: new client.Counter({
    name: 'wbscanner_cache_misses_total',
    help: 'Cache misses',
    registers: [register],
  }),
  vtSubmissions: new client.Counter({
    name: 'wbscanner_vt_submissions_total',
    help: 'VirusTotal submissions',
    registers: [register],
  }),
  gsbHits: new client.Counter({
    name: 'wbscanner_gsb_hits_total',
    help: 'Google Safe Browsing hits',
    registers: [register],
  })
};

export function metricsRoute() {
  return async (_req: any, res: any) => {
    res.header('Content-Type', register.contentType);
    res.send(await register.metrics());
  };
}

