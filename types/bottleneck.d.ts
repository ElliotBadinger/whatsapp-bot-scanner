declare module 'bottleneck' {
  export default class Bottleneck {
    constructor(...args: any[]);
    on(event: string, listener: (...args: any[]) => void): void;
    currentReservoir(): Promise<number>;
    schedule<T>(fn: (...args: any[]) => T | Promise<T>, ...params: any[]): Promise<T>;
  }
}
