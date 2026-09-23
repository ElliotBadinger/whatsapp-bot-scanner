const crypto = require("crypto");

const expectedToken = "my_secret_token_that_is_long_enough";

function checkTokenVulnerable(token) {
  return token === expectedToken;
}

function checkTokenSecure(token) {
  // If lengths don't match, we hash to avoid length leaking in timingSafeEqual
  const expectedHash = crypto
    .createHash("sha256")
    .update(expectedToken)
    .digest();
  const tokenHash = crypto
    .createHash("sha256")
    .update(token || "")
    .digest();
  return crypto.timingSafeEqual(expectedHash, tokenHash);
}

console.log("Testing token comparison...");
