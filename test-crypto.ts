import crypto from 'crypto';

const token = 'my-secret-token';
const csrfToken = crypto.createHash('sha256').update(token).update('csrf-salt').digest('hex');
console.log(csrfToken);
