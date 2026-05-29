const crypto = require('crypto');
function getControlPlaneToken() { return "test-token"; }
console.log(crypto.createHash("sha256").update(getControlPlaneToken() + "csrf-salt").digest("hex"));
