declare module 'ioredis' {
  import type { EventEmitter } from 'node:events';
  export default class Redis extends EventEmitter {
    constructor(...args: any[]);
    set(...args: any[]): Promise<any>;
    del(...args: any[]): Promise<any>;
  }
}
