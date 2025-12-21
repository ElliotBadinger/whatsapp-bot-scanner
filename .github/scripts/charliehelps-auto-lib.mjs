export const suggestionRegex =
  /reply with\s+["“”]?@CharlieHelps\s+yes\s+please["“”]?/i;
export const yesPleaseRegex = /@CharlieHelps\s+yes\s+please/i;

const workingVerbs =
  /(I[’']?m working|Starting|Reviewing|Investigating|Summarizing)/i;
const noReplies =
  /(can[’']?t be interrupted|can[’']?t.*see replies|won[’']?t see replies|can[’']?t pause|can[’']?t be stopped)/i;
const suggestionSummary = /<summary>\s*Suggestion\s*<\/summary>/i;
const suggestionInvite = /if you(?:'|’)?d like me to add/i;
const suggestionNudge = /at minimum/i;
const suggestionLanguage =
  /\b(should|consider|recommend|avoid|prefer|suggest|need to|must|please)\b/i;
const nonSuggestionMarkers = [
  "expand this to see my work",
  "summary of changes",
  "<summary><strong>changes</strong>",
  "<summary><strong>verification</strong>",
  "re-requested review",
];

export function isWorkingMessage(body) {
  if (!body) return false;
  return workingVerbs.test(body) && noReplies.test(body);
}

export function latestComment(comments) {
  if (!comments || comments.length === 0) return null;

  let latest = null;
  let latestTime = -Infinity;
  let invalidCount = 0;
  for (const comment of comments) {
    const t = Date.parse(comment.createdAt);
    if (Number.isNaN(t)) {
      invalidCount += 1;
      continue;
    }
    if (t > latestTime) {
      latestTime = t;
      latest = comment;
    }
  }

  if (process.env.CH_DEBUG === "1") {
    if (invalidCount > 0) {
      console.warn(
        `latestComment ignored ${invalidCount} comment(s) with invalid createdAt`,
      );
    }
    if (!latest) {
      console.warn(
        "latestComment: no valid createdAt timestamps; falling back to last comment",
      );
    }
  }

  return latest ?? comments[comments.length - 1] ?? null;
}

export function isSuggestionComment(body) {
  if (!body) return false;
  const lowered = body.toLowerCase();
  if (nonSuggestionMarkers.some((marker) => lowered.includes(marker))) {
    return false;
  }

  return (
    suggestionRegex.test(body) ||
    suggestionSummary.test(body) ||
    suggestionInvite.test(body) ||
    suggestionNudge.test(body) ||
    suggestionLanguage.test(body)
  );
}

export function hasPendingSuggestion(comments) {
  // Assumptions:
  // - `createdAt` is a reliable ordering key.
  // - We only care about the latest suggestion and the latest valid ack.
  if (!comments || comments.length === 0) return false;

  let latestAckTime = -Infinity;
  let latestSuggestionTime = -Infinity;

  for (const comment of comments) {
    const t = Date.parse(comment.createdAt);
    if (Number.isNaN(t)) continue;

    const authorLogin = (comment.author?.login ?? "").toLowerCase();
    const body = comment.body || "";

    if (authorLogin !== "charliecreates" && yesPleaseRegex.test(body)) {
      const authorType = comment.author?.__typename;
      const isGithubActionsBot =
        authorType === "Bot" && authorLogin.startsWith("github-actions");

      if (authorType !== "User" && !isGithubActionsBot) continue;
      latestAckTime = Math.max(latestAckTime, t);
      continue;
    }

    if (authorLogin === "charliecreates" && isSuggestionComment(body)) {
      latestSuggestionTime = Math.max(latestSuggestionTime, t);
    }
  }

  if (latestSuggestionTime === -Infinity) return false;
  return latestSuggestionTime > latestAckTime;
}

function parsePrNumber(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function getEventPrNumber(eventName, payload) {
  if (!eventName || !payload) return null;

  if (
    eventName === "pull_request_review" ||
    eventName === "pull_request_review_comment" ||
    eventName === "pull_request" ||
    eventName === "pull_request_target"
  ) {
    return parsePrNumber(payload.pull_request?.number);
  }

  if (eventName === "issue_comment") {
    if (!payload.issue?.pull_request) return null;
    return parsePrNumber(payload.issue?.number);
  }

  if (eventName === "workflow_dispatch") {
    // This number is user-provided via workflow inputs; callers must validate
    // it as a real pull request before taking any write action.
    return parsePrNumber(payload.inputs?.pr_number);
  }

  return null;
}

export function validateEventPrNumber(eventName, payload, expectedPrNumber) {
  const eventPr = getEventPrNumber(eventName, payload);

  const mustHavePr = new Set([
    "pull_request_review",
    "pull_request_review_comment",
    "issue_comment",
    "workflow_dispatch",
    "pull_request",
    "pull_request_target",
  ]);

  if (mustHavePr.has(eventName) && eventPr === null) {
    throw new Error(`Unable to resolve PR number from event ${eventName}`);
  }

  if (eventPr !== null && eventPr !== expectedPrNumber) {
    throw new Error(
      `Event PR number (${eventPr}) does not match PR_NUMBER (${expectedPrNumber})`,
    );
  }
}
