/**
 * Lazy metric initialization utilities.
 * 
 * These utilities allow metrics to be defined declaratively but only
 * instantiated when first accessed, reducing startup overhead.
 */

import client from 'prom-client';
import { register } from './metrics';

// Cache for lazy-initialized metrics
const metricCache = new Map<string, client.Metric>();

// Metric definitions for lazy initialization
interface CounterDefinition {
  type: 'counter';
  name: string;
  help: string;
  labelNames?: string[];
}

interface GaugeDefinition {
  type: 'gauge';
  name: string;
  help: string;
  labelNames?: string[];
}

interface HistogramDefinition {
  type: 'histogram';
  name: string;
  help: string;
  labelNames?: string[];
  buckets?: number[];
}

type MetricDefinition = CounterDefinition | GaugeDefinition | HistogramDefinition;

/**
 * Get or create a counter metric lazily.
 */
export function getLazyCounter(name: string, help: string, labelNames?: string[]): client.Counter {
  const key = `counter:${name}`;
  let metric = metricCache.get(key) as client.Counter | undefined;
  
  if (!metric) {
    metric = new client.Counter({
      name,
      help,
      labelNames,
      registers: [register],
    });
    metricCache.set(key, metric);
  }
  
  return metric;
}

/**
 * Get or create a gauge metric lazily.
 */
export function getLazyGauge(name: string, help: string, labelNames?: string[]): client.Gauge {
  const key = `gauge:${name}`;
  let metric = metricCache.get(key) as client.Gauge | undefined;
  
  if (!metric) {
    metric = new client.Gauge({
      name,
      help,
      labelNames,
      registers: [register],
    });
    metricCache.set(key, metric);
  }
  
  return metric;
}

/**
 * Get or create a histogram metric lazily.
 */
export function getLazyHistogram(name: string, help: string, labelNames?: string[], buckets?: number[]): client.Histogram {
  const key = `histogram:${name}`;
  let metric = metricCache.get(key) as client.Histogram | undefined;
  
  if (!metric) {
    metric = new client.Histogram({
      name,
      help,
      labelNames,
      buckets,
      registers: [register],
    });
    metricCache.set(key, metric);
  }
  
  return metric;
}

/**
 * Create a lazy metric factory for a specific metric type.
 * Returns a function that creates/retrieves the metric on first call.
 */
export function createLazyMetric<T extends client.Metric>(
  definition: MetricDefinition
): () => T {
  let instance: T | null = null;
  
  return () => {
    if (instance) return instance;
    
    switch (definition.type) {
      case 'counter':
        instance = new client.Counter({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labelNames,
          registers: [register],
        }) as T;
        break;
      case 'gauge':
        instance = new client.Gauge({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labelNames,
          registers: [register],
        }) as T;
        break;
      case 'histogram':
        instance = new client.Histogram({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labelNames,
          buckets: definition.buckets,
          registers: [register],
        }) as T;
        break;
    }
    
    return instance;
  };
}

/**
 * Check if a metric has been initialized.
 */
export function isMetricInitialized(name: string, type: 'counter' | 'gauge' | 'histogram'): boolean {
  return metricCache.has(`${type}:${name}`);
}

/**
 * Get count of initialized metrics (for debugging).
 */
export function getInitializedMetricCount(): number {
  return metricCache.size;
}

/**
 * Clear all cached metrics (for testing).
 */
export function clearMetricCache(): void {
  metricCache.clear();
}
