import { Type, Static } from '@sinclair/typebox';

export const UrlValidationSchema = Type.Object({
  url: Type.String({
    minLength: 1,
    maxLength: 2048,
    pattern: '^https?://[^\\s/$.?#].[^\\s]*$'
  })
});

export type UrlValidationType = Static<typeof UrlValidationSchema>;

export const ValidationResultSchema = Type.Object({
  isValid: Type.Boolean(),
  errors: Type.Array(Type.String()),
  normalizedUrl: Type.Union([Type.String(), Type.Null()]),
  riskLevel: Type.Union([Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')])
});

export type ValidationResultType = Static<typeof ValidationResultSchema>;

export interface ValidationRule {
  name: string;
  validate: (url: URL) => string | null;
}

export class UrlValidator {
  private static readonly PRIVATE_IP_RANGES = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];

  private static readonly SUSPICIOUS_TLDS = [
    '.tk', '.ml', '.ga', '.cf', '.gq', '.men', '.click', '.download', '.loan', '.racing',
    '.online', '.site', '.website', '.work', '.science', '.rest', '.pro', '.tech'
  ];

  private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:'];

  private rules: ValidationRule[] = [
    {
      name: 'protocol',
      validate: (url: URL) => {
        if (!UrlValidator.ALLOWED_PROTOCOLS.includes(url.protocol)) {
          return `Protocol ${url.protocol} is not allowed`;
        }
        return null;
      }
    },
    {
      name: 'hostname',
      validate: (url: URL) => {
        if (!url.hostname) {
          return 'Hostname is required';
        }
        if (url.hostname.length > 253) {
          return 'Hostname too long';
        }
        return null;
      }
    },
    {
      name: 'private-ip',
      validate: (url: URL) => {
        for (const range of UrlValidator.PRIVATE_IP_RANGES) {
          if (range.test(url.hostname)) {
            return 'Private IP addresses are not allowed';
          }
        }
        return null;
      }
    },
    {
      name: 'suspicious-tld',
      validate: (url: URL) => {
        const lowerHostname = url.hostname.toLowerCase();
        for (const tld of UrlValidator.SUSPICIOUS_TLDS) {
          if (lowerHostname.endsWith(tld)) {
            return `Suspicious TLD ${tld} detected`;
          }
        }
        return null;
      }
    },
    {
      name: 'url-length',
      validate: (url: URL) => {
        if (url.toString().length > 2048) {
          return 'URL too long';
        }
        return null;
      }
    },
    {
      name: 'localhost',
      validate: (url: URL) => {
        const lowerHostname = url.hostname.toLowerCase();
        if (lowerHostname === 'localhost' || lowerHostname.endsWith('.localhost')) {
          return 'Localhost URLs are not allowed';
        }
        return null;
      }
    }
  ];

  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  async validateUrl(urlString: string): Promise<ValidationResultType> {
    const errors: string[] = [];
    let normalizedUrl: string | null = null;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    try {
      const url = new URL(urlString);
      normalizedUrl = url.toString();

      for (const rule of this.rules) {
        const error = rule.validate(url);
        if (error) {
          errors.push(error);
          
          if (rule.name === 'private-ip' || rule.name === 'localhost') {
            riskLevel = 'high';
          } else if (rule.name === 'suspicious-tld') {
            riskLevel = 'medium';
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        normalizedUrl,
        riskLevel
      };
    } catch (_error) {
      errors.push('Invalid URL format');
      return {
        isValid: false,
        errors,
        normalizedUrl: null,
        riskLevel: 'high'
      };
    }
  }

  async validateAndThrow(urlString: string): Promise<string> {
    const result = await this.validateUrl(urlString);
    if (!result.isValid) {
      throw new Error(`URL validation failed: ${result.errors.join(', ')}`);
    }
    return result.normalizedUrl!;
  }
}

export const urlValidator = new UrlValidator();
