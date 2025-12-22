
import { isSuspiciousTld, normalizeUrl, isForbiddenHostname } from "./src/url";

const ITERATIONS = 10000;

async function run() {
    console.log(`Benchmarking URL functions with ${ITERATIONS} iterations...`);

    const startTld = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
        isSuspiciousTld("example.zip");
        isSuspiciousTld("google.com");
        isSuspiciousTld("test.xyz");
    }
    const endTld = performance.now();
    console.log(`isSuspiciousTld: ${(endTld - startTld).toFixed(2)}ms`);

    const startNorm = performance.now();
    const url = "https://example.com/path?utm_source=google&utm_medium=cpc&other=param";
    for (let i = 0; i < ITERATIONS; i++) {
        normalizeUrl(url);
    }
    const endNorm = performance.now();
    console.log(`normalizeUrl: ${(endNorm - startNorm).toFixed(2)}ms`);

    process.env.WA_FORBIDDEN_HOSTNAMES = "bad.com,evil.org";
    const startForbidden = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
        await isForbiddenHostname("bad.com");
        await isForbiddenHostname("good.com");
    }
    const endForbidden = performance.now();
    console.log(`isForbiddenHostname: ${(endForbidden - startForbidden).toFixed(2)}ms`);
}

run();
