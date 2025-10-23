import { isKnownShortener } from '../url-shortener';

describe('shortener detection', () => {
  it('recognises common shorteners', () => {
    expect(isKnownShortener('bit.ly')).toBe(true);
    expect(isKnownShortener('t.co')).toBe(true);
  });

  it('ignores non-shortener domains', () => {
    expect(isKnownShortener('example.com')).toBe(false);
  });
});
