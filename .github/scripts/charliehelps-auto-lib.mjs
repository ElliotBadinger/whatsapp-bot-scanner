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
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  return sorted[sorted.length - 1];
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
    suggestionNudge.test(body)
  );
}

export function hasPendingSuggestion(comments) {
  if (!comments || comments.length === 0) return false;
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  const suggestions = sorted.filter((comment) => {
    const author = comment.author?.login || "";
    return (
      author.toLowerCase() === "charliecreates" &&
      isSuggestionComment(comment.body || "")
    );
  });
  if (suggestions.length === 0) return false;

  for (const suggestion of suggestions) {
    const suggestionTime = new Date(suggestion.createdAt).getTime();
    const hasAckAfter = sorted.some((comment) => {
      if (!yesPleaseRegex.test(comment.body || "")) return false;
      return new Date(comment.createdAt).getTime() > suggestionTime;
    });
    if (!hasAckAfter) return true;
  }

  return false;
}
