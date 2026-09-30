import test from "node:test";
import assert from "node:assert/strict";
import {
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
