import path from "node:path";

const libPath = path.resolve(
  __dirname,
  "../.github/scripts/charliehelps-auto-lib.mjs",
);

describe("charliehelps-auto helpers", () => {
  test("detects working messages", async () => {
    const lib = await import(libPath);
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

  test("detects pending suggestions without newer ack", async () => {
    const lib = await import(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: 'Reply with \"@CharlieHelps yes please\" if you want this.',
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

  test("clears pending suggestion when ack is after", async () => {
    const lib = await import(libPath);
    const comments = [
      {
        author: { login: "charliecreates" },
        body: 'Reply with \"@CharlieHelps yes please\" if you want this.',
        createdAt: "2025-12-21T08:00:00Z",
      },
      {
        author: { login: "ElliotBadinger" },
        body: "@CharlieHelps yes please",
        createdAt: "2025-12-21T08:01:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(false);
  });

  test("does not treat older ack as satisfying newer suggestion", async () => {
    const lib = await import(libPath);
    const comments = [
      {
        author: { login: "ElliotBadinger" },
        body: "@CharlieHelps yes please",
        createdAt: "2025-12-21T08:00:00Z",
      },
      {
        author: { login: "charliecreates" },
        body: 'Reply with \"@CharlieHelps yes please\" if you want this.',
        createdAt: "2025-12-21T08:02:00Z",
      },
    ];
    expect(lib.hasPendingSuggestion(comments)).toBe(true);
  });
});
