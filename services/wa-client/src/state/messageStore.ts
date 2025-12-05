import type { Redis } from 'ioredis';

export interface StoredMessageState {
  chatId: string;
  messageId: string;
  originalBody?: string;
  latestBody?: string;
  from?: string;
  timestamp?: number;
  edits?: Array<{ body: string; editedAt: number }>;
  revoked?: boolean;
  revokedAt?: number | null;
  verdictMessageId?: string;
  verdictHistory?: Array<{ messageId: string; sentAt: number; attempt?: number; status?: string }>;
  reactions?: Record<string, string>;
  mentionedIds?: string[];
  groupMentions?: string[];
  quotedMessageId?: string;
  forwardingScore?: number;
  ackHistory?: Array<{ ack: number; at: number }>;
  deliveredAt?: number | null;
  viewOnce?: boolean;
  ephemeral?: boolean;
  mediaUploadedAt?: number | null;
}

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function stateKey(chatId: string, messageId: string) {
  return `wa:msg:${chatId}:${messageId}`;
}

async function loadState(redis: Redis, chatId: string, messageId: string): Promise<StoredMessageState | null> {
  const raw = await redis.get(stateKey(chatId, messageId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredMessageState;
  } catch {
    return null;
  }
}

async function persistState(redis: Redis, state: StoredMessageState): Promise<void> {
  await redis.set(stateKey(state.chatId, state.messageId), JSON.stringify(state), 'EX', TTL_SECONDS);
}

type EnsureParams = {
  chatId: string;
  messageId: string;
  from?: string;
  body?: string;
  timestamp?: number;
  mentionedIds?: string[];
  groupMentions?: string[];
  quotedMessageId?: string;
  forwardingScore?: number;
  viewOnce?: boolean;
  ephemeral?: boolean;
};

function updateExistingStateFromEnsureParams(existing: StoredMessageState, params: EnsureParams): boolean {
  let mutated = false;

  if (params.body && !existing.originalBody) {
    existing.originalBody = params.body;
    existing.latestBody = params.body;
    mutated = true;
  }

  if (params.mentionedIds && params.mentionedIds.length > 0 && !existing.mentionedIds) {
    existing.mentionedIds = Array.from(new Set(params.mentionedIds));
    mutated = true;
  }

  if (params.groupMentions && params.groupMentions.length > 0 && !existing.groupMentions) {
    existing.groupMentions = Array.from(new Set(params.groupMentions));
    mutated = true;
  }

  if (params.quotedMessageId && !existing.quotedMessageId) {
    existing.quotedMessageId = params.quotedMessageId;
    mutated = true;
  }

  if (typeof params.forwardingScore === 'number' && existing.forwardingScore === undefined) {
    existing.forwardingScore = params.forwardingScore;
    mutated = true;
  }

  if (params.viewOnce !== undefined && existing.viewOnce === undefined) {
    existing.viewOnce = params.viewOnce;
    mutated = true;
  }

  if (params.ephemeral !== undefined && existing.ephemeral === undefined) {
    existing.ephemeral = params.ephemeral;
    mutated = true;
  }

  return mutated;
}

function createInitialState(params: EnsureParams): StoredMessageState {
  return {
    chatId: params.chatId,
    messageId: params.messageId,
    originalBody: params.body,
    latestBody: params.body,
    from: params.from,
    timestamp: params.timestamp ?? Date.now(),
    edits: [],
    revoked: false,
    verdictHistory: [],
    reactions: {},
    mentionedIds: params.mentionedIds ? Array.from(new Set(params.mentionedIds)) : undefined,
    groupMentions: params.groupMentions ? Array.from(new Set(params.groupMentions)) : undefined,
    quotedMessageId: params.quotedMessageId,
    forwardingScore: params.forwardingScore,
    ackHistory: [],
    deliveredAt: null,
    viewOnce: params.viewOnce,
    ephemeral: params.ephemeral,
    revokedAt: null,
    mediaUploadedAt: null,
  };
}

export async function ensureMessageState(redis: Redis, params: EnsureParams): Promise<StoredMessageState> {
  const existing = await loadState(redis, params.chatId, params.messageId);
  if (existing) {
    const mutated = updateExistingStateFromEnsureParams(existing, params);
    if (mutated) {
      await persistState(redis, existing);
    }
    return existing;
  }

  const initial = createInitialState(params);
  await persistState(redis, initial);
  return initial;
}

export async function updateMessageBody(redis: Redis, params: { chatId: string; messageId: string; newBody: string }): Promise<StoredMessageState | null> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  const edits = state.edits ?? [];
  edits.push({ body: params.newBody, editedAt: Date.now() });
  state.edits = edits.slice(-20);
  if (!state.originalBody) state.originalBody = params.newBody;
  state.latestBody = params.newBody;
  state.revoked = false;
  state.revokedAt = null;
  await persistState(redis, state);
  return state;
}

export async function appendMessageEdit(redis: Redis, params: { chatId: string; messageId: string; newBody: string }): Promise<StoredMessageState | null> {
  const state = await loadState(redis, params.chatId, params.messageId);
  if (!state) return null;

  const edits = state.edits ?? [];
  edits.push({ body: params.newBody, editedAt: Date.now() });
  state.edits = edits.slice(-20);
  state.latestBody = params.newBody;

  await persistState(redis, state);
  return state;
}

export async function markMessageRevoked(redis: Redis, params: { chatId: string; messageId: string }): Promise<StoredMessageState | null> {
  const state = await loadState(redis, params.chatId, params.messageId);
  if (!state) return null;
  state.revoked = true;
  state.revokedAt = Date.now();
  await persistState(redis, state);
  return state;
}

export async function recordVerdictAssociation(redis: Redis, params: { chatId: string; messageId: string; verdictMessageId: string; attempt?: number; status?: string }): Promise<void> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  state.verdictMessageId = params.verdictMessageId;
  const history = state.verdictHistory ?? [];
  history.push({ messageId: params.verdictMessageId, sentAt: Date.now(), attempt: params.attempt, status: params.status ?? 'sent' });
  state.verdictHistory = history.slice(-10);
  await persistState(redis, state);
}

export async function clearVerdictAssociation(redis: Redis, params: { chatId: string; messageId: string }): Promise<void> {
  const state = await loadState(redis, params.chatId, params.messageId);
  if (!state) return;
  state.verdictMessageId = undefined;
  await persistState(redis, state);
}

export async function recordReaction(redis: Redis, params: { chatId: string; messageId: string; senderId: string; reaction: string | null }): Promise<void> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  const reactions = state.reactions ?? {};
  if (params.reaction) {
    reactions[params.senderId] = params.reaction;
  } else {
    delete reactions[params.senderId];
  }
  state.reactions = reactions;
  await persistState(redis, state);
}

export async function getMessageState(redis: Redis, chatId: string, messageId: string): Promise<StoredMessageState | null> {
  return loadState(redis, chatId, messageId);
}

export interface MetadataUpdateParams {
  chatId: string;
  messageId: string;
  mentionedIds?: string[];
  groupMentions?: string[];
  quotedMessageId?: string;
  forwardingScore?: number;
  viewOnce?: boolean;
  ephemeral?: boolean;
}

function updateMentionCollections(state: StoredMessageState, params: MetadataUpdateParams): boolean {
  let mutated = false;

  if (params.mentionedIds && params.mentionedIds.length > 0) {
    const next = Array.from(new Set([...(state.mentionedIds ?? []), ...params.mentionedIds]));
    if ((state.mentionedIds ?? []).length !== next.length) {
      state.mentionedIds = next;
      mutated = true;
    }
  }

  if (params.groupMentions && params.groupMentions.length > 0) {
    const next = Array.from(new Set([...(state.groupMentions ?? []), ...params.groupMentions]));
    if ((state.groupMentions ?? []).length !== next.length) {
      state.groupMentions = next;
      mutated = true;
    }
  }

  return mutated;
}

function updateQuotedAndForwarding(state: StoredMessageState, params: MetadataUpdateParams): boolean {
  let mutated = false;

  if (params.quotedMessageId && !state.quotedMessageId) {
    state.quotedMessageId = params.quotedMessageId;
    mutated = true;
  }

  if (typeof params.forwardingScore === 'number' && state.forwardingScore === undefined) {
    state.forwardingScore = params.forwardingScore;
    mutated = true;
  }

  return mutated;
}

function updateVisibilityFlags(state: StoredMessageState, params: MetadataUpdateParams): boolean {
  let mutated = false;

  if (params.viewOnce !== undefined && state.viewOnce !== params.viewOnce) {
    state.viewOnce = params.viewOnce;
    mutated = true;
  }

  if (params.ephemeral !== undefined && state.ephemeral !== params.ephemeral) {
    state.ephemeral = params.ephemeral;
    mutated = true;
  }

  return mutated;
}

export async function upsertMessageMetadata(redis: Redis, params: MetadataUpdateParams): Promise<void> {
  const state = await ensureMessageState(redis, params);
  let mutated = false;

  if (updateMentionCollections(state, params)) {
    mutated = true;
  }

  if (updateQuotedAndForwarding(state, params)) {
    mutated = true;
  }

  if (updateVisibilityFlags(state, params)) {
    mutated = true;
  }

  if (mutated) {
    await persistState(redis, state);
  }
}

export async function recordMessageAck(redis: Redis, params: { chatId: string; messageId: string; ack: number }): Promise<void> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  const history = state.ackHistory ?? [];
  history.push({ ack: params.ack, at: Date.now() });
  state.ackHistory = history.slice(-20);
  if (params.ack >= 2) {
    state.deliveredAt = Date.now();
  }
  await persistState(redis, state);
}

export async function recordMediaUpload(redis: Redis, params: { chatId: string; messageId: string }): Promise<void> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  state.mediaUploadedAt = Date.now();
  await persistState(redis, state);
}
