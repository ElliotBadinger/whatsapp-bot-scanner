import { __testables } from '../index';

const {
  normalizeVerdictReason,
  classifyError,
  shouldRetry,
  normalizeUrlscanArtifactCandidate,
  extractUrlscanArtifactCandidates,
  buildProviderStates,
} = __testables;

describe('scan-orchestrator index helpers', () => {
  test('normalizeVerdictReason maps known categories', () => {
    expect(normalizeVerdictReason('Manually allowed')).toBe('manual_allow');
    expect(normalizeVerdictReason('Manually blocked')).toBe('manual_deny');
    expect(normalizeVerdictReason('Google Safe Browsing: MALWARE')).toBe(
      'gsb_malware',
    );
    expect(
      normalizeVerdictReason('Google Safe Browsing: SOCIAL_ENGINEERING'),
    ).toBe('gsb_social_engineering');
    expect(normalizeVerdictReason('Google Safe Browsing: UNWANTED')).toBe(
      'gsb_threat',
    );
    expect(normalizeVerdictReason('Verified phishing (Phishtank)')).toBe(
      'phishtank_verified',
    );
    expect(normalizeVerdictReason('Known malware distribution (URLhaus)')).toBe(
      'urlhaus_listed',
    );
    expect(normalizeVerdictReason('3 VT engines flagged malicious')).toBe(
      'vt_malicious',
    );
    expect(
      normalizeVerdictReason('Domain registered 3 days ago (<7)'),
    ).toBe('domain_age_lt7');
    expect(
      normalizeVerdictReason('Domain registered 9 days ago (<14)'),
    ).toBe('domain_age_lt14');
    expect(
      normalizeVerdictReason('Domain registered 20 days ago (<30)'),
    ).toBe('domain_age_lt30');
    expect(normalizeVerdictReason('Domain registered 90 days ago')).toBe(
      'domain_age',
    );
    expect(
      normalizeVerdictReason('High-risk homoglyph attack detected (a→b)'),
    ).toBe('homoglyph_high');
    expect(normalizeVerdictReason('Suspicious homoglyph characters detected')).toBe(
      'homoglyph_medium',
    );
    expect(normalizeVerdictReason('Punycode/IDN domain detected')).toBe(
      'homoglyph_low',
    );
    expect(normalizeVerdictReason('URL uses IP address')).toBe('ip_literal');
    expect(normalizeVerdictReason('Suspicious TLD')).toBe('suspicious_tld');
    expect(normalizeVerdictReason('Multiple redirects (3)')).toBe(
      'multiple_redirects',
    );
    expect(normalizeVerdictReason('Uncommon port')).toBe('uncommon_port');
    expect(normalizeVerdictReason('Long URL (250 chars)')).toBe('long_url');
    expect(normalizeVerdictReason('Executable file extension')).toBe(
      'executable_extension',
    );
    expect(normalizeVerdictReason('Shortened URL expanded')).toBe(
      'shortener_expanded',
    );
    expect(normalizeVerdictReason('Redirect leads to mismatched domain/brand')).toBe(
      'redirect_mismatch',
    );
    expect(normalizeVerdictReason('Some other reason')).toBe('other');
  });

  test('classifyError maps codes and messages', () => {
    expect(classifyError({ code: 'UND_ERR_HEADERS_TIMEOUT' })).toBe('timeout');
    expect(classifyError({ code: 'UND_ERR_CONNECT_TIMEOUT' })).toBe('timeout');
    expect(classifyError({ code: 429 })).toBe('rate_limited');
    expect(classifyError({ statusCode: 408 })).toBe('timeout');
    expect(classifyError({ code: 503 })).toBe('server_error');
    expect(classifyError({ code: 404 })).toBe('client_error');
    expect(classifyError(new Error('Circuit is open'))).toBe('circuit_open');
    expect(classifyError(new Error('unknown failure'))).toBe('unknown');
  });

  test('shouldRetry respects retryable conditions', () => {
    expect(shouldRetry({ code: 'UND_ERR_HEADERS_TIMEOUT' })).toBe(true);
    expect(shouldRetry({ code: 429 })).toBe(false);
    expect(shouldRetry({ statusCode: 408 })).toBe(true);
    expect(shouldRetry({ code: 500 })).toBe(true);
    expect(shouldRetry({ code: 400 })).toBe(false);
    expect(shouldRetry(new Error('no code'))).toBe(true);
  });

  test('normalizeUrlscanArtifactCandidate validates host and normalizes URLs', () => {
    const baseUrl = 'https://urlscan.io/';
    const validPath = normalizeUrlscanArtifactCandidate(
      'screenshots/abc.png',
      baseUrl,
    );
    expect(validPath.invalid).toBe(false);
    expect(validPath.url).toBe('https://urlscan.io/screenshots/abc.png');

    const validAbsolute = normalizeUrlscanArtifactCandidate(
      'https://sub.urlscan.io/dom/abc.json',
      baseUrl,
    );
    expect(validAbsolute.invalid).toBe(false);
    expect(validAbsolute.url).toBe('https://sub.urlscan.io/dom/abc.json');

    const invalidHost = normalizeUrlscanArtifactCandidate(
      'https://evil.example.com/dom/abc.json',
      baseUrl,
    );
    expect(invalidHost.invalid).toBe(true);

    const blank = normalizeUrlscanArtifactCandidate('   ', baseUrl);
    expect(blank.invalid).toBe(false);
    expect(blank.url).toBeUndefined();

    const nonString = normalizeUrlscanArtifactCandidate(123 as unknown, baseUrl);
    expect(nonString.invalid).toBe(false);
    expect(nonString.url).toBeUndefined();

    const invalidBase = normalizeUrlscanArtifactCandidate(
      'screenshots/abc.png',
      'not-a-url',
    );
    expect(invalidBase.invalid).toBe(true);
  });

  test('extractUrlscanArtifactCandidates de-duplicates payload URLs', () => {
    const uuid = 'abc-123';
    const payload = {
      screenshotURL: `https://urlscan.io/screenshots/${uuid}.png`,
      domURL: `/dom/${uuid}.json`,
      task: { screenshotURL: `https://urlscan.io/screenshots/${uuid}.png` },
    };

    const candidates = extractUrlscanArtifactCandidates(uuid, payload);
    const screenshots = candidates.filter((c) => c.type === 'screenshot');
    const doms = candidates.filter((c) => c.type === 'dom');

    expect(screenshots).toHaveLength(1);
    expect(doms).toHaveLength(1);
    expect(screenshots[0]?.url).toContain(`/screenshots/${uuid}.png`);
    expect(doms[0]?.url).toContain(`/dom/${uuid}.json`);
  });

  test('buildProviderStates summarizes provider availability', () => {
    const longMessage = 'x'.repeat(120);
    const blocklistResult = {
      gsbMatches: [],
      gsbResult: {
        matches: [],
        error: new Error(longMessage),
        fromCache: false,
        durationMs: 0,
      },
      phishtankResult: null,
      phishtankNeeded: true,
      phishtankError: new Error('phishtank down'),
    };

    const providerStates = buildProviderStates(
      blocklistResult as any,
      undefined,
      true,
      new Error('vt down'),
      null,
      new Error('urlhaus down'),
      true,
    );

    const gsbState = providerStates.find((state) => state.key === 'gsb');
    expect(gsbState?.available).toBe(false);
    expect(gsbState?.reason).toBe(`${longMessage.slice(0, 77)}...`);

    const phishState = providerStates.find(
      (state) => state.key === 'phishtank',
    );
    expect(phishState?.available).toBe(false);
    expect(phishState?.reason).toBe('phishtank down');

    const vtState = providerStates.find((state) => state.key === 'virustotal');
    expect(vtState?.available).toBe(false);
    expect(vtState?.reason).toBe('quota_exhausted');

    const urlhausState = providerStates.find((state) => state.key === 'urlhaus');
    expect(urlhausState?.available).toBe(false);
    expect(urlhausState?.reason).toBe('urlhaus down');
  });
});
