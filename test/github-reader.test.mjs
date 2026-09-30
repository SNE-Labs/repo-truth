import test from "node:test";
import assert from "node:assert/strict";
import {
  GitHubReader,
  parseRepositoryName,
  validateAuthorityPaths,
} from "../src/github-reader.mjs";

test("repository names are bounded to owner/name", () => {
  assert.equal(parseRepositoryName("openai/codex"), "openai/codex");
  assert.throws(() => parseRepositoryName("codex"));
  assert.throws(() => parseRepositoryName("openai/codex/issues"));
});

test("authority paths reject traversal and deduplicate", () => {
  assert.deepEqual(
    validateAuthorityPaths(["README.md", "docs/status.md", "README.md"]),
    ["README.md", "docs/status.md"],
  );
  assert.throws(() => validateAuthorityPaths(["../secret"]));
  assert.throws(() => validateAuthorityPaths(["/absolute"]));
});

function response(value, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return value == null ? "" : JSON.stringify(value);
    },
  };
}

test("bounded pagination reports truncation instead of implying completeness", async () => {
  const pages = [
    [{ id: 1 }, { id: 2 }],
  ];
  const reader = new GitHubReader({
    limit: 1,
    fetchImpl: async () => response(pages.shift() ?? []),
  });

  const window = await reader.paginateWindow("/example", 1);
  assert.deepEqual(window.rows, [{ id: 1 }]);
  assert.equal(window.truncated, true);
  assert.equal(window.source_rows_observed, 2);
});

test("bounded pagination reports complete when the source is exhausted", async () => {
  const pages = [
    [{ id: 1 }, { id: 2 }],
    [],
  ];
  const reader = new GitHubReader({
    limit: 2,
    fetchImpl: async () => response(pages.shift() ?? []),
  });

  const window = await reader.paginateWindow("/example", 2);
  assert.deepEqual(window.rows, [{ id: 1 }, { id: 2 }]);
  assert.equal(window.truncated, false);
});
