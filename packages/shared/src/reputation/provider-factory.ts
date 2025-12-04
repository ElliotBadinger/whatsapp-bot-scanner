/**
 * Lazy-loading provider factory for reputation services.
 * 
 * This module provides lazy initialization of external API providers,
 * only loading and initializing them when actually needed. This reduces
 * startup time and memory usage when providers are disabled.
 */

import { config } from '../config';
import { logger } from '../log';

// Type definitions for providers
export interface VirusTotalProvider {
  vtAnalyzeUrl: (url: string) => Promise<{ data?: unknown; latencyMs?: number; disabled?: boolean }>;
  vtVerdictStats: (analysis: { data?: unknown; disabled?: boolean }) => { malicious: number; suspicious: number; harmless: number } | undefined;
}

export interface GsbProvider {
  gsbLookup: (urls: string[]) => Promise<{ matches: unknown[]; latencyMs?: number }>;
}

export interface UrlhausProvider {
  urlhausLookup: (url: string) => Promise<{ listed: boolean; latencyMs?: number }>;
}

export interface PhishtankProvider {
  phishtankLookup: (url: string) => Promise<{ verified: boolean; latencyMs?: number }>;
}

export interface WhoisXmlProvider {
  whoisXmlLookup: (hostname: string) => Promise<{ record?: { estimatedDomainAgeDays?: number; registrarName?: string } }>;
  disableWhoisXmlForMonth: () => void;
}

export interface WhoDatProvider {
  whoDatLookup: (hostname: string) => Promise<{ record?: { estimatedDomainAgeDays?: number; registrarName?: string } }>;
}

// Provider cache
const providerCache = new Map<string, unknown>();

/**
 * Get the VirusTotal provider, loading it lazily if enabled.
 */
export async function getVirusTotalProvider(): Promise<VirusTotalProvider | null> {
  if (!config.vt.enabled || !config.vt.apiKey) {
    logger.debug('VirusTotal provider disabled or no API key');
    return null;
  }

  const cached = providerCache.get('virustotal') as VirusTotalProvider | undefined;
  if (cached) return cached;

  logger.debug('Lazily loading VirusTotal provider');
  const mod = await import('./virustotal');
  const provider: VirusTotalProvider = {
    vtAnalyzeUrl: mod.vtAnalyzeUrl,
    vtVerdictStats: mod.vtVerdictStats,
  };
  providerCache.set('virustotal', provider);
  return provider;
}

/**
 * Get the Google Safe Browsing provider, loading it lazily if enabled.
 */
export async function getGsbProvider(): Promise<GsbProvider | null> {
  if (!config.gsb.enabled) {
    logger.debug('Google Safe Browsing provider disabled');
    return null;
  }

  const cached = providerCache.get('gsb') as GsbProvider | undefined;
  if (cached) return cached;

  logger.debug('Lazily loading GSB provider');
  const mod = await import('./gsb');
  const provider: GsbProvider = {
    gsbLookup: mod.gsbLookup,
  };
  providerCache.set('gsb', provider);
  return provider;
}

/**
 * Get the URLhaus provider, loading it lazily if enabled.
 */
export async function getUrlhausProvider(): Promise<UrlhausProvider | null> {
  if (!config.urlhaus.enabled) {
    logger.debug('URLhaus provider disabled');
    return null;
  }

  const cached = providerCache.get('urlhaus') as UrlhausProvider | undefined;
  if (cached) return cached;

  logger.debug('Lazily loading URLhaus provider');
  const mod = await import('./urlhaus');
  const provider: UrlhausProvider = {
    urlhausLookup: mod.urlhausLookup,
  };
  providerCache.set('urlhaus', provider);
  return provider;
}

/**
 * Get the Phishtank provider, loading it lazily if enabled.
 */
export async function getPhishtankProvider(): Promise<PhishtankProvider | null> {
  if (!config.phishtank.enabled) {
    logger.debug('Phishtank provider disabled');
    return null;
  }

  const cached = providerCache.get('phishtank') as PhishtankProvider | undefined;
  if (cached) return cached;

  logger.debug('Lazily loading Phishtank provider');
  const mod = await import('./phishtank');
  const provider: PhishtankProvider = {
    phishtankLookup: mod.phishtankLookup,
  };
  providerCache.set('phishtank', provider);
  return provider;
}

/**
 * Get the WhoisXML provider, loading it lazily if enabled.
 */
export async function getWhoisXmlProvider(): Promise<WhoisXmlProvider | null> {
  if (!config.whoisxml?.enabled || !config.whoisxml.apiKey) {
    logger.debug('WhoisXML provider disabled or no API key');
    return null;
  }

  const cached = providerCache.get('whoisxml') as WhoisXmlProvider | undefined;
  if (cached) return cached;

  logger.debug('Lazily loading WhoisXML provider');
  const mod = await import('./whoisxml');
  const provider: WhoisXmlProvider = {
    whoisXmlLookup: mod.whoisXmlLookup,
    disableWhoisXmlForMonth: mod.disableWhoisXmlForMonth,
  };
  providerCache.set('whoisxml', provider);
  return provider;
}

/**
 * Get the Who-Dat provider, loading it lazily if enabled.
 */
export async function getWhoDatProvider(): Promise<WhoDatProvider | null> {
  if (!config.whodat?.enabled) {
    logger.debug('Who-Dat provider disabled');
    return null;
  }

  const cached = providerCache.get('whodat') as WhoDatProvider | undefined;
  if (cached) return cached;

  logger.debug('Lazily loading Who-Dat provider');
  const mod = await import('./whodat');
  const provider: WhoDatProvider = {
    whoDatLookup: mod.whoDatLookup,
  };
  providerCache.set('whodat', provider);
  return provider;
}

/**
 * Check if a provider is loaded (for testing/debugging).
 */
export function isProviderLoaded(name: string): boolean {
  return providerCache.has(name);
}

/**
 * Clear the provider cache (for testing).
 */
export function clearProviderCache(): void {
  providerCache.clear();
}

/**
 * Get summary of loaded providers (for debugging).
 */
export function getLoadedProviders(): string[] {
  return Array.from(providerCache.keys());
}
