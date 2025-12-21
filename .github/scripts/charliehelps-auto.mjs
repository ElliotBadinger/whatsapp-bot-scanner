#!/usr/bin/env node

import {
  hasPendingSuggestion,
  isWorkingMessage,
  latestComment,
} from "./charliehelps-auto-lib.mjs";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const prNumberRaw = process.env.PR_NUMBER;

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
              nodes { author { login } body createdAt url }
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
  const commentsPerThread = 10;

  while (true) {
    const data = await ghGraphQL(
      `query($owner:String!,$name:String!,$number:Int!,$after:String){
        repository(owner:$owner,name:$name){
          pullRequest(number:$number){
            number
            url
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
                  nodes { author { login } body createdAt url }
                }
              }
            }
          }
        }
      }`,
      { owner, name, number: prNumber, after: cursor },
    );

    const pr = data.repository.pullRequest;
    if (!prInfo) prInfo = { ...pr, reviewThreads: undefined };

    threads.push(...pr.reviewThreads.nodes);

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

async function main() {
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

    let pendingSuggestion = hasPendingSuggestion(commentPreview);
    if (pendingSuggestion && thread.comments?.pageInfo?.hasPreviousPage) {
      const fullComments = await fetchThreadComments(thread.id);
      pendingSuggestion = hasPendingSuggestion(fullComments);
    }

    if (pendingSuggestion) {
      toReply.push(thread.id);
    }
  }

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

  if (workingFound) {
    console.log(
      "CharlieHelps is still working; skipping fast-forward to main.",
    );
    return;
  }

  if (toReply.length > 0) {
    console.log(
      "Pending suggestions were just acknowledged; skipping fast-forward to main.",
    );
    return;
  }

  if (pr.isDraft) {
    console.log("PR is a draft; skipping fast-forward to main.");
    return;
  }

  const unresolvedThreads = threads.filter((thread) => !thread.isResolved);
  if (unresolvedThreads.length > 0) {
    console.log(
      `PR has ${unresolvedThreads.length} unresolved review thread(s); skipping fast-forward to main.`,
    );
    return;
  }

  if (pr.baseRefName !== "main") {
    console.log(`PR base is ${pr.baseRefName}; skipping fast-forward to main.`);
    return;
  }

  const headOwner = pr.headRepository?.owner?.login;
  const headRepo = pr.headRepository?.name;
  if (!headOwner || !headRepo || headOwner !== owner || headRepo !== name) {
    console.log(
      "PR head is not in the base repository; skipping fast-forward to main.",
    );
    return;
  }

  if (pr.mergeStateStatus !== "CLEAN" || pr.mergeable !== "MERGEABLE") {
    console.log(
      `PR is not mergeable (mergeStateStatus=${pr.mergeStateStatus}, mergeable=${pr.mergeable}); skipping fast-forward.`,
    );
    return;
  }

  if (pr.statusCheckRollup?.state !== "SUCCESS") {
    console.log(
      `Status checks are not green (state=${pr.statusCheckRollup?.state ?? "UNKNOWN"}); skipping fast-forward.`,
    );
    return;
  }

  const ref = await ghRest(
    "GET",
    `/repos/${owner}/${name}/git/refs/heads/main`,
  );
  const mainSha = ref?.object?.sha;
  if (!mainSha) {
    console.log("Could not resolve main ref SHA; skipping fast-forward.");
    return;
  }

  if (mainSha !== pr.baseRefOid) {
    console.log("PR base is not up-to-date with main; skipping fast-forward.");
    return;
  }

  const latestPr = await getPullRequestState();
  if (latestPr.headRefOid !== pr.headRefOid) {
    console.log(
      `PR head changed from ${pr.headRefOid} to ${latestPr.headRefOid}; skipping fast-forward.`,
    );
    return;
  }
  if (latestPr.baseRefOid !== pr.baseRefOid) {
    console.log(
      `PR base changed from ${pr.baseRefOid} to ${latestPr.baseRefOid}; skipping fast-forward.`,
    );
    return;
  }
  if (latestPr.isDraft) {
    console.log("PR is a draft; skipping fast-forward to main.");
    return;
  }
  if (
    latestPr.mergeStateStatus !== pr.mergeStateStatus ||
    latestPr.mergeable !== pr.mergeable
  ) {
    console.log(
      `PR mergeability changed (mergeStateStatus=${latestPr.mergeStateStatus}, mergeable=${latestPr.mergeable}); skipping fast-forward.`,
    );
    return;
  }
  if (latestPr.statusCheckRollup?.state !== pr.statusCheckRollup?.state) {
    console.log(
      `PR status rollup changed (state=${latestPr.statusCheckRollup?.state ?? "UNKNOWN"}); skipping fast-forward.`,
    );
    return;
  }

  console.log(`Fast-forwarding main from ${mainSha} to ${pr.headRefOid}...`);
  await ghRest("PATCH", `/repos/${owner}/${name}/git/refs/heads/main`, {
    sha: pr.headRefOid,
    force: false,
  });
  console.log("Fast-forward to main completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
