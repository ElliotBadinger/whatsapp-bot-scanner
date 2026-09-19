const crypto = require("crypto");
const a = "abc";
const b = "def";
const c = "abcdef";

const hashA = crypto.createHash("sha256").update(a).digest();
const hashB = crypto.createHash("sha256").update(b).digest();
const hashC = crypto.createHash("sha256").update(c).digest();
const hashA2 = crypto.createHash("sha256").update(a).digest();

console.log("hashA == hashB:", crypto.timingSafeEqual(hashA, hashB));
console.log("hashA == hashC:", crypto.timingSafeEqual(hashA, hashC));
console.log("hashA == hashA2:", crypto.timingSafeEqual(hashA, hashA2));
