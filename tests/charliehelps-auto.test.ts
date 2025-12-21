import path from "node:path";
import { pathToFileURL } from "node:url";

const libPath = path.resolve(
  __dirname,
  "../.github/scripts/charliehelps-auto-lib.mjs",
);

// TypeScript downlevels `import()` to `require()` under CJS, which breaks `.mjs`.
// This keeps a true runtime `import()` so Jest can load ESM helpers.
// The helper is intentionally restricted to `libPath` to avoid accidentally
// importing arbitrary files via `new Function()` in tests.
const importEsm = (() => {
  // eslint-disable-next-line no-new-func
  const importer = new Function("url", "return import(url);");
  return async (filePath: string) => {
    if (filePath !== libPath) {
      throw new Error(
        `importEsm may only be used with libPath (got: ${filePath})`,
      );
    }
    return importer(pathToFileURL(filePath).href);
  };
})();

describe("charliehelps-auto helpers", () => {
  test("detects working messages", async () => {
    const lib = await importEsm(libPath);
    expect(
      lib.isWorkingMessage(
        "I’m working on this now and can’t be interrupted or see replies.",
      ),
    ).toBe(true);
    expect(
      lib.isWorkingMessage(
        "Starting a review; I won’t see replies while I’m working.",
      ),
    ).toBe(true);
    expect(lib.isWorkingMessage("General update without restrictions.")).toBe(
      false,
    );
  });

  test("detects suggestion comment markers", async () => {
    const lib = await importEsm(libPath);
    expect(
      lib.isSuggestionComment(
        'Reply with "@CharlieHelps yes please" if you want this.',
      ),
    ).toBe(true);
    expect(
      lib.isSuggestionComment(
        "<details><summary>Suggestion</summary>\n\nTry doing X</details>",
      ),
    ).toBe(true);
    expect(
      lib.isSuggestionComment(
        "If you'd like me to add a commit implementing this, reply yes.",
      ),
    ).toBe(true);
    expect(lib.isSuggestionComment("At minimum, add a guard.")).toBe(true);
    expect(lib.isSuggestionComment("FYI, I reran CI.")).toBe(false);
    expect(
      lib.isSuggestionComment(
        "<details><summary>Expand this to see my work.</summary>\n\n- Did things\n</details>",
      ),
    ).toBe(false);
  });

  test("detects pending suggestions without newer ack", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: 'Reply with "@CharlieHelps yes please" if you want this.',
        createdAt: "2025-12-21T08:00:00Z",
      },
      {
        author: { login: "someone" },
        body: "Not an ack",
        createdAt: "2025-12-21T08:01:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(true);
  });

  test("detects suggestion prompt with smart quotes", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: "Reply with “@CharlieHelps yes please” if you want this.",
        createdAt: "2025-12-21T08:00:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(true);
  });

  test("clears pending suggestion when ack is after", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { __typename: "Bot", login: "charliecreates" },
        body: 'Reply with "@CharlieHelps yes please" if you want this.',
        createdAt: "2025-12-21T08:00:00Z",
      },
      {
        author: { __typename: "User", login: "ElliotBadinger" },
        body: "@CharlieHelps yes please",
        createdAt: "2025-12-21T08:01:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(false);
  });

  test("does not treat CharlieCreates ack as satisfying suggestion", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: 'Reply with "@CharlieHelps yes please" if you want this.',
        createdAt: "2025-12-21T08:00:00Z",
      },
      {
        author: { login: "charliecreates" },
        body: "@CharlieHelps yes please",
        createdAt: "2025-12-21T08:01:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(true);
  });

  test("does not clear pending suggestion when ack is from a bot", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { __typename: "Bot", login: "charliecreates" },
        body: 'Reply with "@CharlieHelps yes please" if you want this.',
        createdAt: "2025-12-21T08:00:00Z",
      },
      {
        author: { __typename: "Bot", login: "chatgpt-codex-connector" },
        body: "@CharlieHelps yes please",
        createdAt: "2025-12-21T08:01:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(true);
  });

  test("treats github-actions bot ack as satisfying suggestion", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { __typename: "Bot", login: "charliecreates" },
        body: "At minimum, add a hard gate so this job only runs for a trusted actor.",
        createdAt: "2025-12-21T07:59:00Z",
      },
      {
        author: { __typename: "Bot", login: "github-actions[bot]" },
        body: "@CharlieHelps yes please",
        createdAt: "2025-12-21T08:00:00Z",
      },
    ];

    expect(lib.hasPendingSuggestion(comments)).toBe(false);
  });

  test("does not treat older ack as satisfying newer suggestion", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { __typename: "User", login: "ElliotBadinger" },
        body: "@CharlieHelps yes please",
        createdAt: "2025-12-21T08:00:00Z",
      },
      {
        author: { login: "charliecreates" },
        body: 'Reply with "@CharlieHelps yes please" if you want this.',
        createdAt: "2025-12-21T08:02:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(true);
  });

  test("treats non-working CharlieHelps review comment as suggestion", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: "At minimum, add an explicit gate for trusted actors.",
        createdAt: "2025-12-21T08:00:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(true);
  });

  test("ignores bot acknowledgements", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: "At minimum, add a guard.",
        createdAt: "2025-12-21T08:00:00Z",
      },
      {
        author: { login: "some-bot", __typename: "Bot" },
        body: "@CharlieHelps yes please",
        createdAt: "2025-12-21T08:01:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(true);
  });

  test("does not treat summaries as suggestions", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: "<details><summary>Summary of changes</summary></details>",
        createdAt: "2025-12-21T08:00:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(false);
  });

  test("ignores work summary updates", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: "<details><summary>Expand this to see my work.</summary>\n\n- Did things\n</details>",
        createdAt: "2025-12-21T08:00:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(false);
  });

  test("does not treat generic Charlie comment as suggestion", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: "FYI, I reran CI.",
        createdAt: "2025-12-21T08:00:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(false);
  });

  test("validates PR number against GitHub event payload", async () => {
    const lib = await importEsm(libPath);

    expect(
      lib.getEventPrNumber("issue_comment", {
        issue: { number: 145, pull_request: {} },
      }),
    ).toBe(145);

    expect(
      lib.getEventPrNumber("pull_request_review", {
        pull_request: { number: 145 },
      }),
    ).toBe(145);

    expect(() => {
      lib.validateEventPrNumber(
        "pull_request_review",
        { pull_request: { number: 123 } },
        145,
      );
    }).toThrow(/does not match PR_NUMBER/i);
  });

  test("latestComment skips invalid timestamps and returns latest valid", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "someone" },
        body: "old",
        createdAt: "invalid",
      },
      {
        author: { login: "someone" },
        body: "middle",
        createdAt: "2025-12-21T08:00:00Z",
      },
      {
        author: { login: "someone" },
        body: "latest",
        createdAt: "2025-12-21T09:00:00Z",
      },
    ];
    expect(lib.latestComment(comments)?.body).toBe("latest");
  });

  test("latestComment falls back to last comment when all timestamps invalid", async () => {
    const lib = await importEsm(libPath);
    const comments = [
      {
        author: { login: "someone" },
        body: "first",
        createdAt: "bad1",
      },
      {
        author: { login: "someone" },
        body: "second",
        createdAt: "bad2",
      },
    ];
    expect(lib.latestComment(comments)?.body).toBe("second");
  });
});
