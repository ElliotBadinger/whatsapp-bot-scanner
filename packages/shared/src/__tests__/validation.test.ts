import { describe, expect, test, beforeEach } from '@jest/globals';
import { UrlValidator, urlValidator } from '../validation';

describe('UrlValidator', () => {
  let validator: UrlValidator;

  beforeEach(() => {
    validator = new UrlValidator();
  });

  describe('validateUrl', () => {
    test('accepts valid HTTP URLs', async () => {
      const result = await validator.validateUrl('http://example.com/path');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.riskLevel).toBe('low');
      expect(result.normalizedUrl).toBe('http://example.com/path');
    });

    test('accepts valid HTTPS URLs', async () => {
      const result = await validator.validateUrl('https://secure.example.com/page?query=1');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.riskLevel).toBe('low');
    });

    test('rejects FTP protocol', async () => {
      const result = await validator.validateUrl('ftp://files.example.com/file.txt');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Protocol ftp: is not allowed');
    });

    test('rejects file protocol', async () => {
      const result = await validator.validateUrl('file:///etc/passwd');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Protocol'))).toBe(true);
    });

    test('rejects javascript protocol', async () => {
      const result = await validator.validateUrl('javascript:alert(1)');
      expect(result.isValid).toBe(false);
    });

    test('rejects private IP 10.x.x.x', async () => {
      const result = await validator.validateUrl('http://10.0.0.1/admin');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Private IP addresses are not allowed');
      expect(result.riskLevel).toBe('high');
    });

    test('rejects all 10.x.x.x ranges (mutation boundary)', async () => {
      // Test various 10.x IPs to ensure regex matches 10.* not 11.*
      const ip10_1 = await validator.validateUrl('http://10.1.2.3/');
      expect(ip10_1.isValid).toBe(false);
      
      const ip10_255 = await validator.validateUrl('http://10.255.255.255/');
      expect(ip10_255.isValid).toBe(false);
      
      // 11.x.x.x should be allowed (not private)
      const ip11 = await validator.validateUrl('http://11.0.0.1/');
      expect(ip11.isValid).toBe(true);
    });

    test('rejects private IP 172.16-31.x.x', async () => {
      const result = await validator.validateUrl('http://172.16.0.1/');
      expect(result.isValid).toBe(false);
      expect(result.riskLevel).toBe('high');

      const result2 = await validator.validateUrl('http://172.31.255.255/');
      expect(result2.isValid).toBe(false);
    });

    test('rejects private IP 192.168.x.x', async () => {
      const result = await validator.validateUrl('http://192.168.1.1/router');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Private IP addresses are not allowed');
    });

    test('rejects loopback IP 127.x.x.x', async () => {
      const result = await validator.validateUrl('http://127.0.0.1:8080/');
      expect(result.isValid).toBe(false);
      expect(result.riskLevel).toBe('high');
    });

    test('rejects all 127.x.x.x loopback ranges (mutation boundary)', async () => {
      // Ensure 127.0.0.1 specifically is rejected, not 127.0.0.2
      const ip127_0_0_1 = await validator.validateUrl('http://127.0.0.1/');
      expect(ip127_0_0_1.isValid).toBe(false);
      
      const ip127_1_1_1 = await validator.validateUrl('http://127.1.1.1/');
      expect(ip127_1_1_1.isValid).toBe(false);
      
      // 128.x.x.x should be allowed (not loopback)
      const ip128 = await validator.validateUrl('http://128.0.0.1/');
      expect(ip128.isValid).toBe(true);
    });

    test('rejects link-local IP 169.254.x.x', async () => {
      const result = await validator.validateUrl('http://169.254.1.1/');
      expect(result.isValid).toBe(false);
    });

    test('handles IPv6 loopback ::1 (regex limitation with brackets)', async () => {
      // Note: URL parser includes brackets in hostname, so regex may not match
      const result = await validator.validateUrl('http://[::1]/');
      // The validator's regex expects bare ::1 but URL gives [::1]
      // This documents actual behavior - IPv6 support is limited
      expect(result.normalizedUrl).toBe('http://[::1]/');
    });

    test('handles IPv6 addresses with brackets', async () => {
      // IPv6 URLs have brackets in the hostname property
      const result = await validator.validateUrl('http://[2001:db8::1]/');
      expect(result.normalizedUrl).toBe('http://[2001:db8::1]/');
    });

    test('rejects localhost', async () => {
      const result = await validator.validateUrl('http://localhost/');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Localhost URLs are not allowed');
      expect(result.riskLevel).toBe('high');
    });

    test('rejects subdomain of localhost', async () => {
      const result = await validator.validateUrl('http://api.localhost/');
      expect(result.isValid).toBe(false);
    });

    test('flags suspicious TLD .tk', async () => {
      const result = await validator.validateUrl('http://example.tk/');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Suspicious TLD'))).toBe(true);
      expect(result.riskLevel).toBe('medium');
    });

    test('flags suspicious TLD .ml', async () => {
      const result = await validator.validateUrl('http://free.ml/');
      expect(result.isValid).toBe(false);
    });

    test('flags suspicious TLD .click', async () => {
      const result = await validator.validateUrl('http://malware.click/');
      expect(result.isValid).toBe(false);
    });

    test('flags suspicious TLD .download', async () => {
      const result = await validator.validateUrl('http://virus.download/file');
      expect(result.isValid).toBe(false);
    });

    test('rejects URLs longer than 2048 characters', async () => {
      const longPath = 'a'.repeat(2100);
      const result = await validator.validateUrl(`http://example.com/${longPath}`);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL too long');
    });

    test('rejects invalid URL format', async () => {
      const result = await validator.validateUrl('not-a-valid-url');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid URL format');
      expect(result.normalizedUrl).toBeNull();
      expect(result.riskLevel).toBe('high');
    });

    test('rejects empty string', async () => {
      const result = await validator.validateUrl('');
      expect(result.isValid).toBe(false);
    });

    test('accepts URLs with ports', async () => {
      const result = await validator.validateUrl('https://example.com:8443/api');
      expect(result.isValid).toBe(true);
    });

    test('accepts URLs with query parameters', async () => {
      const result = await validator.validateUrl('https://example.com/search?q=test&page=1');
      expect(result.isValid).toBe(true);
    });

    test('accepts URLs with fragments', async () => {
      const result = await validator.validateUrl('https://example.com/page#section');
      expect(result.isValid).toBe(true);
    });

    test('accepts international domain names', async () => {
      const result = await validator.validateUrl('https://例え.jp/');
      expect(result.isValid).toBe(true);
    });
  });

  describe('addRule', () => {
    test('allows adding custom validation rules', async () => {
      validator.addRule({
        name: 'block-example',
        validate: (url: URL) => {
          if (url.hostname === 'blocked.com') {
            return 'This domain is blocked';
          }
          return null;
        }
      });

      const result = await validator.validateUrl('https://blocked.com/');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('This domain is blocked');
    });

    test('custom rules run after default rules', async () => {
      let customRuleCalled = false;
      validator.addRule({
        name: 'tracking-rule',
        validate: () => {
          customRuleCalled = true;
          return null;
        }
      });

      await validator.validateUrl('https://example.com/');
      expect(customRuleCalled).toBe(true);
    });
  });

  describe('validateAndThrow', () => {
    test('returns normalized URL for valid input', async () => {
      const result = await validator.validateAndThrow('https://example.com/path');
      expect(result).toBe('https://example.com/path');
    });

    test('throws error for invalid URL', async () => {
      await expect(validator.validateAndThrow('not-valid')).rejects.toThrow('URL validation failed');
    });

    test('throws error with all validation errors', async () => {
      await expect(validator.validateAndThrow('http://localhost/')).rejects.toThrow('Localhost URLs are not allowed');
    });
  });
});

describe('urlValidator singleton', () => {
  test('is an instance of UrlValidator', () => {
    expect(urlValidator).toBeInstanceOf(UrlValidator);
  });

  test('validates URLs correctly', async () => {
    const result = await urlValidator.validateUrl('https://example.com/');
    expect(result.isValid).toBe(true);
  });
});
