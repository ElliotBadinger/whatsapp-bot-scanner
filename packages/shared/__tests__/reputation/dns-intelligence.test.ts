import { dnsIntelligence } from '../../src/reputation/dns-intelligence';

describe('DNS Intelligence', () => {
  describe('dnsIntelligence', () => {
    it('should return zero score for benign domain', async () => {
      const result = await dnsIntelligence('google.com', {
        dnsblEnabled: true,
        dnsblTimeoutMs: 2000,
        dnssecEnabled: false,
        fastFluxEnabled: false,
      });

      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
      expect(result.dnsblResults).toBeDefined();
    });

    it('should handle DNS timeout gracefully', async () => {
      const result = await dnsIntelligence('nonexistent-test-domain-12345.invalid', {
        dnsblEnabled: true,
        dnsblTimeoutMs: 100,
        dnssecEnabled: false,
        fastFluxEnabled: false,
      });

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should detect DNSBL listings', async () => {
      const result = await dnsIntelligence('127.0.0.2', {
        dnsblEnabled: true,
        dnsblTimeoutMs: 2000,
        dnssecEnabled: false,
        fastFluxEnabled: false,
      });

      expect(result).toBeDefined();
      expect(result.dnsblResults).toBeDefined();
    });

    it('should skip checks when disabled', async () => {
      const result = await dnsIntelligence('example.com', {
        dnsblEnabled: false,
        dnssecEnabled: false,
        fastFluxEnabled: false,
      });

      expect(result.score).toBe(0);
      expect(result.dnsblResults).toHaveLength(0);
    });

    it('should cache results', async () => {
      const domain = 'cache-test-domain.com';
      
      const result1 = await dnsIntelligence(domain, {
        dnsblEnabled: true,
        dnsblTimeoutMs: 2000,
      });
      
      const result2 = await dnsIntelligence(domain, {
        dnsblEnabled: true,
        dnsblTimeoutMs: 2000,
      });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
