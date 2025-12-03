declare module 'bottleneck' {
  export default class Bottleneck {
    constructor(...args: any[]);
    schedule<T>(fn: (...args: any[]) => Promise<T> | T, ...args: any[]): Promise<T>;
    on(event: string, handler: (...args: any[]) => void): void;
    currentReservoir(): Promise<number | null>;
  }
}

declare module 'confusables' {
  export default function removeConfusables(value: string): string;
}
