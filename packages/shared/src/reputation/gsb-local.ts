import { createHash } from 'crypto';
import { request } from 'undici';
import { _config } from '../config';
import { logger } from '../log';
import { Redis } from 'ioredis';

export interface GsbLocalThreatMatch {
    threatType: string;
    matchedHashPrefix: string;
}

export interface GsbLocalLookupResult {
    matches: GsbLocalThreatMatch[];
    latencyMs: number;
    source: 'local' | 'remote';
}

const GSB_LOCAL_DB_PREFIX = 'gsb:local:prefix:';
const GSB_UPDATE_STATE_KEY = 'gsb:local:update_state';
const HASH_PREFIX_LENGTH = 4; // 4-byte prefixes

export class GsbLocalDatabase {
    private redis: Redis;
    private apiKey: string;
    private threatListNames: string[] = [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION'
    ];

    constructor(redis: Redis, apiKey: string) {
        this.redis = redis;
        this.apiKey = apiKey;
    }

    /**
     * Lookup URLs against the local GSB database
     */
    async lookup(urls: string[]): Promise<GsbLocalLookupResult> {
        if (!this.apiKey || urls.length === 0) {
            return { matches: [], latencyMs: 0, source: 'local' };
        }

        const start = Date.now();
        const matches: GsbLocalThreatMatch[] = [];

        for (const url of urls) {
            const hashPrefixes = this.computeHashPrefixes(url);
            for (const prefix of hashPrefixes) {
                const threatType = await this.checkLocalDatabase(prefix);
                if (threatType) {
                    matches.push({
                        threatType,
                        matchedHashPrefix: prefix
                    });
                    break; // One match per URL is sufficient
                }
            }
        }

        const latencyMs = Date.now() - start;

        // If we have matches, verify with remote API (to avoid false positives)
        if (matches.length > 0) {
            return this.verifyWithRemoteApi(urls, matches, latencyMs);
        }

        return { matches, latencyMs, source: 'local' };
    }

    /**
     * Verify potential matches with the remote GSB API
     */
    private async verifyWithRemoteApi(
        urls: string[],
        potentialMatches: GsbLocalThreatMatch[],
        localLatencyMs: number
    ): Promise<GsbLocalLookupResult> {
        try {
            const body = {
                client: { clientId: 'wbscanner', clientVersion: '0.1' },
                threatInfo: {
                    threatTypes: this.threatListNames,
                    platformTypes: ['ANY_PLATFORM'],
                    threatEntryTypes: ['URL'],
                    threatEntries: urls.map(u => ({ url: u }))
                }
            };

            const res = await request(
                `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                    headersTimeout: 5000,
                    bodyTimeout: 5000
                }
            );

            const json = await res.body.json() as { matches?: Array<{ threatType: string }> };
            const confirmedMatches: GsbLocalThreatMatch[] = Array.isArray(json?.matches)
                ? json.matches.map(m => ({
                    threatType: m.threatType,
                    matchedHashPrefix: potentialMatches[0]?.matchedHashPrefix || ''
                }))
                : [];

            return {
                matches: confirmedMatches,
                latencyMs: localLatencyMs + (Date.now() - Date.now()),
                source: 'remote'
            };
        } catch (err) {
            logger.warn({ err }, 'GSB remote verification failed, returning local matches');
            return { matches: potentialMatches, latencyMs: localLatencyMs, source: 'local' };
        }
    }

    /**
     * Check if a hash prefix exists in the local database
     */
    private async checkLocalDatabase(hashPrefix: string): Promise<string | null> {
        try {
            const key = `${GSB_LOCAL_DB_PREFIX}${hashPrefix}`;
            const threatType = await this.redis.get(key);
            return threatType;
        } catch (err) {
            logger.warn({ err, hashPrefix }, 'Failed to check local GSB database');
            return null;
        }
    }

    /**
     * Compute hash prefixes for a URL
     */
    private computeHashPrefixes(url: string): string[] {
        const canonicalUrl = this.canonicalizeUrl(url);
        const suffixes = this.generateSuffixPrefixes(canonicalUrl);
        const hashPrefixes: string[] = [];

        for (const suffix of suffixes) {
            const fullHash = createHash('sha256').update(suffix).digest('hex');
            const prefix = fullHash.substring(0, HASH_PREFIX_LENGTH * 2); // 4 bytes = 8 hex chars
            hashPrefixes.push(prefix);
        }

        return hashPrefixes;
    }

    /**
     * Canonicalize URL per GSB specification
     */
    private canonicalizeUrl(url: string): string {
        try {
            let canonical = url.trim().toLowerCase();
            canonical = canonical.replace(/^https?:\/\//, '');
            canonical = canonical.replace(/\/+/g, '/');
            canonical = canonical.replace(/\?.*$/, ''); // Remove query params
            canonical = canonical.replace(/#.*$/, ''); // Remove fragment
            return canonical;
        } catch {
            return url;
        }
    }

    /**
     * Generate suffix/prefix expressions for URL checking
     */
    private generateSuffixPrefixes(canonicalUrl: string): string[] {
        const suffixes: string[] = [];
        const parts = canonicalUrl.split('/');

        // Add full URL
        suffixes.push(canonicalUrl);

        // Add hostname variations
        if (parts[0]) {
            const hostParts = parts[0].split('.');
            for (let i = 0; i < hostParts.length - 1; i++) {
                suffixes.push(hostParts.slice(i).join('.'));
            }
        }

        return suffixes;
    }

    /**
     * Download and update the local database from GSB Update API
     */
    async updateDatabase(): Promise<void> {
        try {
            logger.info('Starting GSB local database update');

            // Get current state
            const stateJson = await this.redis.get(GSB_UPDATE_STATE_KEY);
            const state = stateJson ? JSON.parse(stateJson) : {};

            const requestBody = {
                client: {
                    clientId: 'wbscanner',
                    clientVersion: '0.1'
                },
                listUpdateRequests: this.threatListNames.map(threatType => ({
                    threatType,
                    platformType: 'ANY_PLATFORM',
                    threatEntryType: 'URL',
                    state: state[threatType] || '',
                    constraints: {
                        maxUpdateEntries: 2048,
                        maxDatabaseEntries: 100000,
                        supportedCompressions: ['RAW']
                    }
                }))
            };

            const res = await request(
                `https://safebrowsing.googleapis.com/v4/threatListUpdates:fetch?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    headersTimeout: 30000,
                    bodyTimeout: 30000
                }
            );

            const response = await res.body.json() as {
                listUpdateResponses?: Array<{
                    threatType: string;
                    newClientState: string;
                    additions?: Array<{ rawHashes?: { prefixSize: number; rawHashes: string } }>;
                    removals?: Array<{ rawIndices?: { indices: number[] } }>;
                    responseType: string;
                }>;
            };

            if (!response.listUpdateResponses) {
                logger.warn('No update responses from GSB');
                return;
            }

            const pipeline = this.redis.pipeline();
            let totalAdditions = 0;

            for (const listUpdate of response.listUpdateResponses) {
                const { threatType, newClientState, additions, responseType } = listUpdate;

                // Handle full update (clear existing data)
                if (responseType === 'FULL_UPDATE') {
                    logger.info({ threatType }, 'Performing full GSB update');
                    const pattern = `${GSB_LOCAL_DB_PREFIX}*:${threatType}`;
                    const keys = await this.redis.keys(pattern);
                    if (keys.length > 0) {
                        pipeline.del(...keys);
                    }
                }

                // Process additions
                if (additions) {
                    for (const addition of additions) {
                        if (addition.rawHashes) {
                            const { rawHashes } = addition.rawHashes;
                            const buffer = Buffer.from(rawHashes, 'base64');
                            const prefixSize = addition.rawHashes.prefixSize || HASH_PREFIX_LENGTH;

                            for (let offset = 0; offset < buffer.length; offset += prefixSize) {
                                const hashPrefix = buffer.slice(offset, offset + prefixSize).toString('hex');
                                const key = `${GSB_LOCAL_DB_PREFIX}${hashPrefix}`;
                                pipeline.set(key, threatType, 'EX', 86400); // 24-hour expiry
                                totalAdditions++;
                            }
                        }
                    }
                }

                // Update state
                state[threatType] = newClientState;
            }

            // Save new state
            pipeline.set(GSB_UPDATE_STATE_KEY, JSON.stringify(state));
            await pipeline.exec();

            logger.info({ totalAdditions, threatTypes: Object.keys(state) }, 'GSB local database updated successfully');
        } catch (err) {
            logger.error({ err }, 'Failed to update GSB local database');
            throw err;
        }
    }

    /**
     * Get database statistics
     */
    async getStats(): Promise<{ totalPrefixes: number; threatTypes: Record<string, number> }> {
        const pattern = `${GSB_LOCAL_DB_PREFIX}*`;
        const keys = await this.redis.keys(pattern);
        const totalPrefixes = keys.length;

        const threatTypes: Record<string, number> = {};
        for (const threatType of this.threatListNames) {
            const typePattern = `${GSB_LOCAL_DB_PREFIX}*:${threatType}`;
            const typeKeys = await this.redis.keys(typePattern);
            threatTypes[threatType] = typeKeys.length;
        }

        return { totalPrefixes, threatTypes };
    }
}
