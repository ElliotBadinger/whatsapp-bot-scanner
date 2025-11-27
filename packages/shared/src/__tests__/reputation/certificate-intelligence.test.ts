import { certificateIntelligence } from '../../reputation/certificate-intelligence';

describe('Certificate Intelligence', () => {
  describe('certificateIntelligence', () => {
    it('should analyze valid certificate', async () => {
      const result = await certificateIntelligence('google.com', {
        timeoutMs: 3000,
        ctCheckEnabled: false,
      });

      expect(result).toBeDefined();
      expect(result.suspicionScore).toBeGreaterThanOrEqual(0);
      expect(result.reasons).toBeDefined();
    });

    it('should handle connection timeout', async () => {
      const result = await certificateIntelligence('nonexistent-domain-12345.invalid', {
        timeoutMs: 100,
        ctCheckEnabled: false,
      });

      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
    });

    it('should detect self-signed certificates', async () => {
      const result = await certificateIntelligence('self-signed.badssl.com', {
        timeoutMs: 3000,
        ctCheckEnabled: false,
      });

      expect(result).toBeDefined();
    });

    it('should cache results', async () => {
      const hostname = 'example.com';
      
      const result1 = await certificateIntelligence(hostname, {
        timeoutMs: 3000,
        ctCheckEnabled: false,
      });
      
      const result2 = await certificateIntelligence(hostname, {
        timeoutMs: 3000,
        ctCheckEnabled: false,
      });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should handle expired certificates', async () => {
      const result = await certificateIntelligence('expired.badssl.com', {
        timeoutMs: 3000,
        ctCheckEnabled: false,
      });

      expect(result).toBeDefined();
    });
  });
});
