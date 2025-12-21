#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const prNumberRaw = process.env.PR_NUMBER;

if (!token) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}
if (!repo || !prNumberRaw) {
  console.error('GITHUB_REPOSITORY and PR_NUMBER are required');
  process.exit(1);
}

const prNumber = Number(prNumberRaw);
if (!Number.isInteger(prNumber)) {
  console.error(`PR_NUMBER is not an integer: ${prNumberRaw}`);
  process.exit(1);
}

const [owner, name] = repo.split('/');

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.github+json',
};

async function ghGraphQL(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GraphQL error ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

async function ghRest(method, url, body) {
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`REST error ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const suggestionRegex = /reply with\s+"?@CharlieHelps\s+yes\s+please"?/i;
const yesPleaseRegex = /@CharlieHelps\s+yes\s+please/i;
const workingRegexes = [
  /I[’']?m working/i,
  /(can\'?t|can’t).*(interrupted|see replies)/i,
  /(won\'?t|won’t) see replies while I[’']?m working/i,
];

function isWorkingMessage(body) {
  if (!body) return false;
  return workingRegexes.every((regex) => regex.test(body));
}

function hasYesPlease(comments) {
  return comments.some((comment) => yesPleaseRegex.test(comment.body || ''));
}

function hasSuggestion(comments) {
  return comments.some((comment) => {
    const author = comment.author?.login || '';
    if (author.toLowerCase() !== 'charliecreates') return false;
    return suggestionRegex.test(comment.body || '');
  });
}

function latestComment(comments) {
  const sorted = [...comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return sorted[sorted.length - 1];
}

async function getPullRequestWithThreads() {
  const threads = [];
  let cursor = null;
  let prInfo = null;

  while (true) {
    const data = await ghGraphQL(
      `query($owner:String!,$name:String!,$number:Int!,$after:String){
        repository(owner:$owner,name:$name){
          pullRequest(number:$number){
            number
            url
            baseRefName
            baseRefOid
            headRefOid
            mergeable
            mergeStateStatus
            headRepository { name owner { login } }
            reviewThreads(first:100, after:$after){
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                isResolved
                comments(first:100){
                  nodes { author { login } body createdAt url }
                }
              }
            }
          }
        }
      }`,
      { owner, name, number: prNumber, after: cursor }
    );

    const pr = data.repository.pullRequest;
    if (!prInfo) prInfo = pr;

    threads.push(...pr.reviewThreads.nodes);

    if (!pr.reviewThreads.pageInfo.hasNextPage) break;
    cursor = pr.reviewThreads.pageInfo.endCursor;
  }

  prInfo.reviewThreads = { nodes: threads };
  return prInfo;
}

async function replyToThread(threadId) {
  const data = await ghGraphQL(
    `mutation($id:ID!,$body:String!){
      addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){
        comment { url }
      }
    }`,
    { id: threadId, body: '@CharlieHelps yes please' }
  );
  return data.addPullRequestReviewThreadReply.comment.url;
}

async function main() {
  const pr = await getPullRequestWithThreads();

  const threads = pr.reviewThreads.nodes;
  let workingFound = false;
  const toReply = [];

  for (const thread of threads) {
    const comments = thread.comments.nodes || [];
    if (comments.length === 0) continue;

    const latest = latestComment(comments);
    if (latest?.author?.login?.toLowerCase() === 'charliecreates' && isWorkingMessage(latest.body || '')) {
      workingFound = true;
      continue;
    }

    if (!hasSuggestion(comments)) continue;
    if (hasYesPlease(comments)) continue;

    toReply.push(thread.id);
  }

  if (toReply.length > 0) {
    console.log(`Replying to ${toReply.length} suggestion threads on PR #${pr.number}...`);
    for (const threadId of toReply) {
      const url = await replyToThread(threadId);
      console.log(`Replied: ${url}`);
    }
  } else {
    console.log('No pending suggestion threads to reply to.');
  }

  if (workingFound) {
    console.log('CharlieHelps is still working; skipping fast-forward to main.');
    return;
  }

  if (toReply.length > 0) {
    console.log('Pending suggestions were just acknowledged; skipping fast-forward to main.');
    return;
  }

  if (pr.baseRefName !== 'main') {
    console.log(`PR base is ${pr.baseRefName}; skipping fast-forward to main.`);
    return;
  }

  const headOwner = pr.headRepository?.owner?.login;
  const headRepo = pr.headRepository?.name;
  if (!headOwner || !headRepo || headOwner !== owner || headRepo !== name) {
    console.log('PR head is not in the base repository; skipping fast-forward to main.');
    return;
  }

  if (pr.mergeStateStatus !== 'CLEAN' || pr.mergeable !== 'MERGEABLE') {
    console.log(`PR is not mergeable (mergeStateStatus=${pr.mergeStateStatus}, mergeable=${pr.mergeable}); skipping fast-forward.`);
    return;
  }

  const ref = await ghRest('GET', `/repos/${owner}/${name}/git/refs/heads/main`);
  const mainSha = ref?.object?.sha;
  if (!mainSha) {
    console.log('Could not resolve main ref SHA; skipping fast-forward.');
    return;
  }

  if (mainSha !== pr.baseRefOid) {
    console.log('PR base is not up-to-date with main; skipping fast-forward.');
    return;
  }

  console.log(`Fast-forwarding main from ${mainSha} to ${pr.headRefOid}...`);
  await ghRest('PATCH', `/repos/${owner}/${name}/git/refs/heads/main`, {
    sha: pr.headRefOid,
    force: false,
  });
  console.log('Fast-forward to main completed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
