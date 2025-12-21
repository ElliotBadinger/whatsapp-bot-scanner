#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;

if (!token || !repo) {
  console.error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  process.exit(1);
}

const [owner, name, ...rest] = repo.split("/");
if (!owner || !name || rest.length > 0) {
  console.error(`GITHUB_REPOSITORY must be in owner/repo form, got: ${repo}`);
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/vnd.github+json",
};

const retryStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, options = {}, attempt = 1) {
  const res = await fetch(url, { ...options, headers });
  if (res.ok) return res;
  if (retryStatusCodes.has(res.status) && attempt < 5) {
    const delay = Math.min(15000, 1000 * 2 ** (attempt - 1));
    await sleep(delay);
    return request(url, options, attempt + 1);
  }
  const text = await res.text();
  throw new Error(`Request failed ${res.status}: ${text}`);
}

async function graphql(query, variables) {
  const res = await request("https://api.github.com/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

async function searchPullRequests(cursor = null) {
  const query = `
    query($query:String!,$after:String){
      search(query:$query, type:ISSUE, first:50, after:$after){
        pageInfo { hasNextPage endCursor }
        nodes {
          ... on PullRequest {
            number
            title
            isDraft
            headRefName
            mergeable
            mergeStateStatus
          }
        }
      }
    }
  `;
  const searchQuery = `repo:${owner}/${name} is:pr is:open head:deepsource-transform-`;
  return graphql(query, { query: searchQuery, after: cursor });
}

async function mergePullRequest(number) {
  const url = `https://api.github.com/repos/${owner}/${name}/pulls/${number}/merge`;
  const res = await request(url, {
    method: "PUT",
    body: JSON.stringify({
      merge_method: "squash",
    }),
  });
  return res.json();
}

async function deleteBranch(branch) {
  const url = `https://api.github.com/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(branch)}`;
  await request(url, { method: "DELETE" });
}

async function main() {
  let cursor = null;
  const candidates = [];
  while (true) {
    const data = await searchPullRequests(cursor);
    const nodes = data.search.nodes || [];
    for (const pr of nodes) {
      if (!pr) continue;
      if (pr.isDraft) continue;
      if (!pr.headRefName?.startsWith("deepsource-transform-")) continue;
      candidates.push(pr);
    }
    if (!data.search.pageInfo.hasNextPage) break;
    cursor = data.search.pageInfo.endCursor;
  }

  if (candidates.length === 0) {
    console.log("No deepsource-transform PRs to merge.");
    return;
  }

  console.log(`Found ${candidates.length} deepsource-transform PR(s).`);
  for (const pr of candidates) {
    const mergeable = pr.mergeable === "MERGEABLE";
    const clean = pr.mergeStateStatus !== "DIRTY";
    if (!mergeable || !clean) {
      console.log(
        `Skipping #${pr.number} (${pr.mergeable}/${pr.mergeStateStatus}).`,
      );
      continue;
    }
    console.log(`Merging #${pr.number} (${pr.title})...`);
    await mergePullRequest(pr.number);
    await deleteBranch(pr.headRefName);
    console.log(`Merged #${pr.number} and deleted ${pr.headRefName}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
