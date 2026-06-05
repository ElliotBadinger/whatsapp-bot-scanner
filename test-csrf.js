const crypto = require("crypto");
const token = "test-token";
console.log(
  crypto
    .createHash("sha256")
    .update(token + "csrf-salt")
    .digest("hex"),
);
