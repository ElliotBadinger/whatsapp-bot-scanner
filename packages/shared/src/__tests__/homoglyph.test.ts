import { detectHomoglyphs } from '../homoglyph';

describe('Homoglyph Detection', () => {
  it('detects Cyrillic "а" in PayPal impersonation', () => {
    const result = detectHomoglyphs('pаypal.com'); // Cyrillic a
    expect(result.detected).toBe(true);
    expect(result.riskLevel).toBe('high');
    expect(result.confusableChars.some((c) => c.original === 'а')).toBe(true);
  });

  it('flags Greek omicron substitutions', () => {
    const result = detectHomoglyphs('gοοgle.com');
    expect(result.detected).toBe(true);
    expect(result.riskLevel).toBe('high');
  });

  it('marks punycode domains as medium risk when no confusables present', () => {
    const result = detectHomoglyphs('xn--80akhbyknj4f.com');
    expect(result.detected).toBe(true);
    expect(result.riskLevel === 'medium' || result.riskLevel === 'high').toBe(true);
  });

  it('treats legitimate IDN as low risk when no brand similarity', () => {
    const result = detectHomoglyphs('münchen.de');
    expect(result.detected).toBe(true);
    expect(result.riskLevel).not.toBe('high');
  });

  it('provides confusable character mapping', () => {
    const result = detectHomoglyphs('microsοft.com');
    const omicron = result.confusableChars.find((c) => c.original === 'ο');
    expect(omicron).toBeDefined();
    expect(omicron?.confusedWith.toLowerCase()).toContain('o');
  });

  it('handles multiple confusable characters', () => {
    const result = detectHomoglyphs('gооgle.com');
    expect(result.confusableChars.length).toBeGreaterThanOrEqual(2);
    expect(result.riskLevel).toBe('high');
  });
});
