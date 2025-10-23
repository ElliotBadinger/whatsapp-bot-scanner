import { detectHomoglyphs } from '../homoglyph';

describe('homoglyph detection', () => {
  it('detects Cyrillic substitutions in PayPal impersonations', () => {
    const result = detectHomoglyphs('pаypal.com'); // Cyrillic "а"
    expect(result.detected).toBe(true);
    expect(result.riskLevel).toBe('high');
    const cyrillicA = result.confusableChars.find(entry => entry.original === 'а' && entry.confusedWith === 'a');
    expect(cyrillicA).toBeDefined();
    expect(result.riskReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('Mixed scripts detected')]),
    );
  });

  it('captures Greek homoglyphs in Google lookalikes', () => {
    const result = detectHomoglyphs('gοοgle.com');
    expect(result.detected).toBe(true);
    expect(result.riskLevel).toBe('high');
    expect(result.confusableChars.filter(entry => entry.original === 'ο')).toHaveLength(2);
    expect(result.riskReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('Greek')]),
    );
  });

  it('treats punycode hostnames with confusables as high risk', () => {
    const result = detectHomoglyphs('xn--80akhbyknj4f.com');
    expect(result.isPunycode).toBe(true);
    expect(result.detected).toBe(true);
    expect(result.riskLevel).toBe('high');
    expect(result.riskReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('punycode/IDN encoding')]),
    );
  });

  it('does not throw on malformed punycode labels', () => {
    expect(() => detectHomoglyphs('xn--.com')).not.toThrow();
    const result = detectHomoglyphs('xn--.com');
    expect(result.unicodeHostname).toBe('xn--.com');
    expect(result.isPunycode).toBe(true);
  });

  it('treats benign Latin IDNs as safe when no confusables present', () => {
    const result = detectHomoglyphs('münchen.de');
    expect(result.detected).toBe(false);
    expect(result.riskLevel).toBe('none');
    expect(result.confusableChars).toHaveLength(0);
  });

  it('reports multiple confusable characters', () => {
    const result = detectHomoglyphs('gооgle-secure.com');
    expect(result.confusableChars.length).toBeGreaterThanOrEqual(2);
    expect(result.riskLevel).toBe('high');
    const pairs = result.confusableChars.map(entry => `${entry.original}→${entry.confusedWith}`);
    expect(pairs).toEqual(expect.arrayContaining(['о→o']));
  });
});
