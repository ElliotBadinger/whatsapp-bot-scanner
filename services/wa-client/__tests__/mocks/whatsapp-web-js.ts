export class LocalAuth {
  constructor(_: any = {}) {}
}

export class RemoteAuth {
  constructor(_: any = {}) {}
}

export class MessageMedia {
  constructor(
    public mimetype: string,
    public data: string,
    public filename?: string,
  ) {}
}

export class Location {
  constructor(
    public latitude: number,
    public longitude: number,
    public options: { name?: string; address?: string } = {},
  ) {}
}

export class Client {
  public info: any = { wid: { _serialized: "mock@c.us" } };
  public handlers = new Map<string, Array<(...args: any[]) => unknown>>();
  static instances: Client[] = [];
  static clearInstances() {
    Client.instances = [];
  }

  constructor(_: any = {}) {
    Client.instances.push(this);
  }

  on(event: string, handler: (...args: any[]) => unknown): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }
  async emit(event: string, ...args: any[]): Promise<void> {
    const handlers = this.handlers.get(event) ?? [];
    for (const handler of handlers) {
      await handler(...args);
    }
  }
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): Promise<void> {
    return Promise.resolve();
  }
  sendMessage(): Promise<any> {
    return Promise.resolve({ id: { _serialized: "msg-1" } });
  }
  getMessageById(): Promise<any> {
    return Promise.resolve(null);
  }
  getChatById(): Promise<any> {
    return Promise.resolve(null);
  }
  getState(): Promise<string> {
    return Promise.resolve("CONNECTED");
  }
  requestPairingCode(): Promise<string> {
    return Promise.resolve("123-456");
  }
  approveGroupMembershipRequests(): Promise<void> {
    return Promise.resolve();
  }
}

export type Message = any;
export type GroupChat = any;
export type GroupNotification = any;
export type Reaction = any;
export type MessageAck = any;
export type Call = any;
export type Contact = any;
export type GroupParticipant = any;

export default {
  Client,
  LocalAuth,
  RemoteAuth,
  MessageMedia,
  Location,
};
