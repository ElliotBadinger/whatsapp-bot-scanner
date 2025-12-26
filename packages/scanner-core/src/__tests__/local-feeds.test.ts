import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const createTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "wbscanner-feeds-"));

describe("local feed lookup", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    process.env.LOCAL_FEED_DIR = tempDir;
    delete process.env.OPENPHISH_LOCAL_PATH;
    delete process.env.URLHAUS_LOCAL_PATH;
    delete process.env.SANS_LOCAL_PATH;
    jest.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.LOCAL_FEED_DIR;
  });

  test("detects openphish and urlhaus URL matches", () => {
    const openphishUrl = "http://example.com/phish";
    const urlhausUrl = "https://malware.test/path";

    fs.writeFileSync(
      path.join(tempDir, "openphish.txt"),
      `${openphishUrl}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(tempDir, "urlhaus.txt"),
      `${urlhausUrl}\n`,
      "utf8",
    );
    fs.writeFileSync(path.join(tempDir, "sans-domains.txt"), "", "utf8");
    fs.writeFileSync(path.join(tempDir, "majestic-top-domains.txt"), "", "utf8");

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      lookupLocalFeedSignals,
      resetLocalFeedCache,
    } = require("../local-feeds");
    resetLocalFeedCache();

    const openphishSignals = lookupLocalFeedSignals(openphishUrl);
    const urlhausSignals = lookupLocalFeedSignals(urlhausUrl);

    expect(openphishSignals.openphishListed).toBe(true);
    expect(urlhausSignals.urlhausListed).toBe(true);
  });

  test("detects suspicious domains from SANS feed", () => {
    fs.writeFileSync(path.join(tempDir, "openphish.txt"), "", "utf8");
    fs.writeFileSync(path.join(tempDir, "urlhaus.txt"), "", "utf8");
    fs.writeFileSync(
      path.join(tempDir, "sans-domains.txt"),
      "suspicious.test\n",
      "utf8",
    );
    fs.writeFileSync(path.join(tempDir, "majestic-top-domains.txt"), "", "utf8");

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      lookupLocalFeedSignals,
      resetLocalFeedCache,
    } = require("../local-feeds");
    resetLocalFeedCache();

    const signals = lookupLocalFeedSignals("https://suspicious.test/path");
    expect(signals.suspiciousDomainListed).toBe(true);
  });

  test("detects typosquat domains against top list", () => {
    fs.writeFileSync(path.join(tempDir, "openphish.txt"), "", "utf8");
    fs.writeFileSync(path.join(tempDir, "urlhaus.txt"), "", "utf8");
    fs.writeFileSync(path.join(tempDir, "sans-domains.txt"), "", "utf8");
    fs.writeFileSync(
      path.join(tempDir, "majestic-top-domains.txt"),
      "google.com\nfacebook.com\n",
      "utf8",
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { lookupLocalFeedSignals, resetLocalFeedCache } = require("../local-feeds");
    resetLocalFeedCache();

    const signals = lookupLocalFeedSignals("https://gogle.com/login");
    expect(signals.typoSquatTarget).toBe("google.com");
    expect(signals.typoSquatMethod).toBe("missing-char");
  });
});
