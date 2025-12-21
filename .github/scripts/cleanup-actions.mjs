#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const keepDaysRaw = process.env.KEEP_DAYS || "14";

if (!token || !repo) {
  console.error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  process.exit(1);
}

const keepDays = Number(keepDaysRaw);
if (!Number.isFinite(keepDays) || keepDays <= 0) {
  console.error(`Invalid KEEP_DAYS: ${keepDaysRaw}`);
  process.exit(1);
}

const [owner, name] = repo.split("/");

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/vnd.github+json",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, options = {}, attempt = 1) {
  const res = await fetch(url, { ...options, headers });
  if (res.ok) return res;

  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const delay = Math.min(15000, 1000 * 2 ** (attempt - 1));
    console.log(`Retrying ${url} after ${delay}ms (status ${res.status})`);
    await sleep(delay);
    return request(url, options, attempt + 1);
  }

  const text = await res.text();
  throw new Error(`Request failed ${res.status}: ${text}`);
}

function cutoffIso(days) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

async function listRuns(page = 1) {
  const url = new URL(
    `https://api.github.com/repos/${owner}/${name}/actions/runs`,
  );
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  url.searchParams.set("status", "completed");
  return request(url.toString()).then((res) => res.json());
}

async function deleteRun(runId) {
  const url = `https://api.github.com/repos/${owner}/${name}/actions/runs/${runId}`;
  await request(url, { method: "DELETE" });
}

async function main() {
  const cutoff = cutoffIso(keepDays);
  console.log(`Deleting workflow runs completed before ${cutoff}`);

  let page = 1;
  let deleted = 0;
  while (true) {
    const data = await listRuns(page);
    const runs = data.workflow_runs || [];
    if (runs.length === 0) break;

    for (const run of runs) {
      if (!run.updated_at) continue;
      if (run.updated_at < cutoff) {
        await deleteRun(run.id);
        deleted += 1;
        console.log(`Deleted run ${run.id} (${run.name || run.workflow_id})`);
      }
    }

    if (runs.length < 100) break;
    page += 1;
  }

  console.log(`Cleanup complete. Deleted ${deleted} runs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
