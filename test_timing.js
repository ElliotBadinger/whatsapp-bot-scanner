import { timingSafeEqual } from 'node:crypto';
console.log(timingSafeEqual(Buffer.from('a'), Buffer.from('b')));
