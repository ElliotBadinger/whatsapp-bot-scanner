export const suggestionRegex = /reply with\s+"?@CharlieHelps\s+yes\s+please"?/i;
export const yesPleaseRegex = /@CharlieHelps\s+yes\s+please/i;

const workingVerbs =
  /(I[’']?m working|Starting|Reviewing|Investigating|Summarizing)/i;
const noReplies =
  /(can'?t be interrupted|can'?t.*see replies|won'?t see replies|can'?t pause|can'?t be stopped)/i;

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

export function hasPendingSuggestion(comments) {
  if (!comments || comments.length === 0) return false;
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  const suggestions = sorted.filter((comment) => {
    const author = comment.author?.login || "";
    return (
      author.toLowerCase() === "charliecreates" &&
      suggestionRegex.test(comment.body || "")
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
