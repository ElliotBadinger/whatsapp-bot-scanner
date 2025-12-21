#!/usr/bin/env node

import {
  hasPendingSuggestion,
  isWorkingMessage,
  latestComment,
  validateEventPrNumber,
} from "./charliehelps-auto-lib.mjs";
import fs from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const prNumberRaw = process.env.PR_NUMBER;
const rawMode = process.env.MODE ?? "reply";
const mode = rawMode.toLowerCase();
const mergeMethod = (process.env.MERGE_METHOD ?? "rebase").toLowerCase();
const eventName = process.env.GITHUB_EVENT_NAME;
const eventPath = process.env.GITHUB_EVENT_PATH;
const actor = process.env.GITHUB_ACTOR;

const allowedModes = new Set(["reply", "merge"]);
if (!allowedModes.has(mode)) {
  console.error(
    `Invalid MODE=${rawMode}. Expected one of: ${Array.from(allowedModes).join(
      ", ",
    )}.`,
  );
  process.exit(1);
}

if (mode === "merge") {
  const allowedMergeMethods = new Set(["merge", "rebase", "squash"]);
  if (!allowedMergeMethods.has(mergeMethod)) {
    console.error(
      `Invalid MERGE_METHOD=${mergeMethod}. Expected one of: ${Array.from(
        allowedMergeMethods,
      ).join(", ")}.`,
    );
    process.exit(1);
  }
}

if (!token) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}
if (!repo || !prNumberRaw) {
  console.error("GITHUB_REPOSITORY and PR_NUMBER are required");
  process.exit(1);
}

const prNumber = Number(prNumberRaw);
if (!Number.isInteger(prNumber)) {
  console.error(`PR_NUMBER is not an integer: ${prNumberRaw}`);
  process.exit(1);
}

const [owner, name] = repo.split("/");

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/vnd.github+json",
};

class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.retryable = true;
  }
}

const retryStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
const maxAttempts = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function backoffMs(attempt) {
  const base = 1000;
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(15000, base * 2 ** (attempt - 1) + jitter);
}

function shouldRetryResponse(res) {
  if (retryStatusCodes.has(res.status)) return true;
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") return true;
  }
  return false;
}

async function withRetry(label, fn) {
  let attempt = 1;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err?.retryable === true;
      if (!retryable || attempt >= maxAttempts) throw err;
      const delay = backoffMs(attempt);
      console.log(
        `[retry] ${label} attempt ${attempt} failed, retrying in ${delay}ms`,
      );
      await sleep(delay);
      attempt += 1;
    }
  }
}

async function ghGraphQL(query, variables) {
  return withRetry("graphql", async () => {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (shouldRetryResponse(res)) {
        throw new RetryableError(
          `GraphQL retryable error ${res.status}: ${text}`,
        );
      }
      throw new Error(`GraphQL error ${res.status}: ${text}`);
    }
    const data = await res.json();
    if (data.errors) {
      const message = JSON.stringify(data.errors);
      if (
        /rate limit|timeout|timed out|temporarily unavailable/i.test(message)
      ) {
        throw new RetryableError(`GraphQL retryable errors: ${message}`);
      }
      throw new Error(`GraphQL errors: ${message}`);
    }
    return data.data;
  });
}

async function ghRest(method, url, body) {
  return withRetry("rest", async () => {
    const res = await fetch(`https://api.github.com${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      if (shouldRetryResponse(res)) {
        throw new RetryableError(`REST retryable error ${res.status}: ${text}`);
      }
      throw new Error(`REST error ${res.status}: ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
  });
}

async function fetchThreadComments(threadId) {
  const comments = [];
  let cursor = null;

  while (true) {
    const data = await ghGraphQL(
      `query($id:ID!,$after:String){
        node(id:$id){
          ... on PullRequestReviewThread{
            comments(first:100, after:$after){
              pageInfo { hasNextPage endCursor }
              nodes { author { __typename login } body createdAt url }
            }
          }
        }
      }`,
      { id: threadId, after: cursor },
    );

    const node = data.node;
    const page = node?.comments;
    if (!page) break;
    comments.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  return comments;
}

async function getPullRequestWithThreads() {
  const threads = [];
  let cursor = null;
  let prInfo = null;

  const DEFAULT_COMMENTS_PER_THREAD = 10;
  const MAX_COMMENTS_PER_THREAD = 50;

  const rawCommentsPerThread = process.env.CH_REV_COMMENTS_PER_THREAD;
  const parsedCommentsPerThread =
    rawCommentsPerThread && /^\d+$/.test(rawCommentsPerThread)
      ? Number(rawCommentsPerThread)
      : DEFAULT_COMMENTS_PER_THREAD;
  const commentsPerThread = Math.min(
    Math.max(parsedCommentsPerThread, 1),
    MAX_COMMENTS_PER_THREAD,
  );

  while (true) {
    const data = await ghGraphQL(
      `query($owner:String!,$name:String!,$number:Int!,$after:String){
        repository(owner:$owner,name:$name){
          pullRequest(number:$number){
            number
            url
            state
            isDraft
            baseRefName
            baseRefOid
            headRefOid
            mergeable
            mergeStateStatus
            statusCheckRollup { state }
            headRepository { name owner { login } }
            reviewThreads(first:100, after:$after){
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                isResolved
                comments(last:${commentsPerThread}){
                  pageInfo { hasPreviousPage startCursor }
                  nodes { author { __typename login } body createdAt url }
                }
              }
            }
          }
        }
      }`,
      { owner, name, number: prNumber, after: cursor },
    );

    const pr = data.repository.pullRequest;
    if (!pr) {
      throw new Error(`Pull request #${prNumber} not found.`);
    }
    if (!prInfo) prInfo = { ...pr, reviewThreads: undefined };

    threads.push(
      ...pr.reviewThreads.nodes.map((thread) => {
        const comments = thread.comments ?? {
          nodes: [],
          pageInfo: { hasPreviousPage: false },
        };
        const pageInfo = {
          ...(comments.pageInfo ?? {}),
          hasPreviousPage: Boolean(comments.pageInfo?.hasPreviousPage),
        };

        return {
          ...thread,
          comments: {
            nodes: Array.isArray(comments.nodes) ? [...comments.nodes] : [],
            pageInfo,
          },
        };
      }),
    );

    if (!pr.reviewThreads.pageInfo.hasNextPage) break;
    cursor = pr.reviewThreads.pageInfo.endCursor;
  }

  prInfo.reviewThreads = { nodes: threads };
  return prInfo;
}

async function getPullRequestState() {
  const data = await ghGraphQL(
    `query($owner:String!,$name:String!,$number:Int!){
      repository(owner:$owner,name:$name){
        pullRequest(number:$number){
          number
          url
          state
          isDraft
          baseRefName
          baseRefOid
          headRefOid
          mergeable
          mergeStateStatus
          statusCheckRollup { state }
          headRepository { name owner { login } }
        }
      }
    }`,
    { owner, name, number: prNumber },
  );

  if (!data.repository.pullRequest) {
    throw new Error(`Pull request #${prNumber} not found.`);
  }

  return data.repository.pullRequest;
}

async function replyToThread(threadId) {
  const data = await ghGraphQL(
    `mutation($id:ID!,$body:String!){
      addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){
        comment { url }
      }
    }`,
    { id: threadId, body: "@CharlieHelps yes please" },
  );
  return data.addPullRequestReviewThreadReply.comment.url;
}

async function validateEventContext() {
  if (!eventName || !eventPath) return;

  let raw;
  try {
    raw = await fs.readFile(eventPath, "utf8");
  } catch (err) {
    throw new Error(
      `Unable to read GitHub event file (event=${eventName}): ${err?.message ?? err}`,
    );
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Unable to parse GitHub event payload (event=${eventName}): ${err?.message ?? err}`,
    );
  }

  validateEventPrNumber(eventName, payload, prNumber);
}

async function hasPendingSuggestionForThread(thread, commentPreview) {
  // We treat the latest comment window as authoritative: if it indicates a
  // pending suggestion and the window is truncated, we hydrate full history
  // to check for older acks before replying.
  if (!commentPreview || commentPreview.length === 0) return false;

  const previewPending = hasPendingSuggestion(commentPreview);
  if (!previewPending) return false;

  if (!thread.comments?.pageInfo?.hasPreviousPage) return true;
  const fullComments = await fetchThreadComments(thread.id);
  return hasPendingSuggestion(fullComments);
}

async function main() {
  await validateEventContext();

  if (mode === "merge" && eventName !== "workflow_dispatch") {
    throw new Error(
      `MODE=merge is only supported for workflow_dispatch events (got event=${eventName ?? "UNKNOWN"}).`,
    );
  }

  if (
    mode === "merge" &&
    actor &&
    actor.toLowerCase() !== owner.toLowerCase()
  ) {
    throw new Error(
      `MODE=merge may only be invoked by the repository owner (${owner}).`,
    );
  }
  const pr = await getPullRequestWithThreads();

  const threads = pr.reviewThreads.nodes;
  let workingFound = false;
  const toReply = [];

  for (const thread of threads) {
    const commentPreview = thread.comments?.nodes || [];
    if (commentPreview.length === 0) continue;

    const latest = latestComment(commentPreview);
    if (
      latest?.author?.login?.toLowerCase() === "charliecreates" &&
      isWorkingMessage(latest.body || "")
    ) {
      workingFound = true;
      continue;
    }

    const pendingSuggestion = await hasPendingSuggestionForThread(
      thread,
      commentPreview,
    );

    if (pendingSuggestion) {
      toReply.push(thread.id);
    }
  }

  if (mode === "reply") {
    if (toReply.length > 0) {
      console.log(
        `Replying to ${toReply.length} suggestion threads on PR #${pr.number}...`,
      );
      for (const threadId of toReply) {
        const url = await replyToThread(threadId);
        console.log(`Replied: ${url}`);
      }
    } else {
      console.log("No pending suggestion threads to reply to.");
    }
    console.log(`MODE=${mode}; skipping merge to main.`);
    return;
  }

  if (pr.state && pr.state !== "OPEN") {
    console.log(`PR is not open (state=${pr.state}); skipping merge to main.`);
    return;
  }

  if (workingFound) {
    console.log(
      "CharlieHelps is still working; skipping merge to main.",
    );
    return;
  }

  if (toReply.length > 0) {
    console.log(
      `Found ${toReply.length} pending suggestion thread(s); skipping merge to main.`,
    );
    return;
  }

  if (pr.isDraft) {
    console.log("PR is a draft; skipping merge to main.");
    return;
  }

  const unresolvedThreads = threads.filter((thread) => !thread.isResolved);
  if (unresolvedThreads.length > 0) {
    console.log(
      `PR has ${unresolvedThreads.length} unresolved review thread(s); skipping merge to main.`,
    );
    return;
  }

  if (pr.baseRefName !== "main") {
    console.log(`PR base is ${pr.baseRefName}; skipping merge to main.`);
    return;
  }

  const headOwner = pr.headRepository?.owner?.login;
  const headRepo = pr.headRepository?.name;
  if (!headOwner || !headRepo || headOwner !== owner || headRepo !== name) {
    console.log(
      "PR head is not in the base repository; skipping merge to main.",
    );
    return;
  }

  if (pr.mergeStateStatus !== "CLEAN" || pr.mergeable !== "MERGEABLE") {
    console.log(
      `PR is not mergeable (mergeStateStatus=${pr.mergeStateStatus}, mergeable=${pr.mergeable}); skipping merge.`,
    );
    return;
  }

  if (pr.statusCheckRollup?.state !== "SUCCESS") {
    console.log(
      `Status checks are not green (state=${pr.statusCheckRollup?.state ?? "UNKNOWN"}); skipping merge.`,
    );
    return;
  }

  const ref = await ghRest(
    "GET",
    `/repos/${owner}/${name}/git/refs/heads/main`,
  );
  const mainSha = ref?.object?.sha;
  if (!mainSha) {
    console.log("Could not resolve main ref SHA; skipping merge.");
    return;
  }

  if (mainSha !== pr.baseRefOid) {
    console.log("PR base is not up-to-date with main; skipping merge.");
    return;
  }

  const latestPr = await getPullRequestState();
  if (latestPr.headRefOid !== pr.headRefOid) {
    console.log(
      `PR head changed from ${pr.headRefOid} to ${latestPr.headRefOid}; skipping merge.`,
    );
    return;
  }
  if (latestPr.baseRefOid !== pr.baseRefOid) {
    console.log(
      `PR base changed from ${pr.baseRefOid} to ${latestPr.baseRefOid}; skipping merge.`,
    );
    return;
  }
  if (latestPr.isDraft) {
    console.log("PR is a draft; skipping merge to main.");
    return;
  }
  if (
    latestPr.mergeStateStatus !== pr.mergeStateStatus ||
    latestPr.mergeable !== pr.mergeable
  ) {
    console.log(
      `PR mergeability changed (mergeStateStatus=${latestPr.mergeStateStatus}, mergeable=${latestPr.mergeable}); skipping merge.`,
    );
    return;
  }
  if (latestPr.statusCheckRollup?.state !== pr.statusCheckRollup?.state) {
    console.log(
      `PR status rollup changed (state=${latestPr.statusCheckRollup?.state ?? "UNKNOWN"}); skipping merge.`,
    );
    return;
  }

  console.log(
    `Merging PR #${pr.number} to main (method=${mergeMethod}, expectedSha=${pr.headRefOid})...`,
  );
  const result = await ghRest(
    "PUT",
    `/repos/${owner}/${name}/pulls/${prNumber}/merge`,
    {
      sha: pr.headRefOid,
      merge_method: mergeMethod,
    },
  );

  if (result?.merged !== true) {
    throw new Error(
      `Merge API did not report success for PR #${pr.number} (merged=${result?.merged ?? "UNKNOWN"}).`,
    );
  }

  console.log(
    `Merge to main completed (sha=${result?.sha ?? "UNKNOWN"}, merged=${result?.merged ?? "UNKNOWN"}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
