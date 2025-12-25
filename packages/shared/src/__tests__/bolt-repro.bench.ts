
import { extractUrls, isSuspiciousTld } from '../url';
import { performance } from 'perf_hooks';

const iterations = 10000;
const text = "Check out this link https://example.com and this one www.google.com and maybe evil.zip too.";
const hostname = "test.zip";

console.log("Starting benchmark...");

const startExtract = performance.now();
for (let i = 0; i < iterations; i++) {
  extractUrls(text);
}
const endExtract = performance.now();
console.log(`extractUrls: ${(endExtract - startExtract).toFixed(2)}ms for ${iterations} iterations`);

const startTld = performance.now();
for (let i = 0; i < iterations * 10; i++) {
  isSuspiciousTld(hostname);
}
const endTld = performance.now();
console.log(`isSuspiciousTld: ${(endTld - startTld).toFixed(2)}ms for ${iterations * 10} iterations`);
