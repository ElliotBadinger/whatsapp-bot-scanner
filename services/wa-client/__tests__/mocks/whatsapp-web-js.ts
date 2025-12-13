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
  constructor(_: any = {}) {}

  on(): void {}
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
