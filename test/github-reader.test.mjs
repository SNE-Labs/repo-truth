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

test("private-repository 404 explains authentication when no token is available", async () => {
  const reader = new GitHubReader({
    limit: 10,
    authResolver: () => ({ token: null, source: "none" }),
    fetchImpl: async () => response({
      message: "Not Found",
      documentation_url: "https://docs.github.com/rest/repos/repos#get-a-repository",
      status: "404",
    }, 404),
  });

  await assert.rejects(
    () => reader.load("acme/private"),
    /repository_not_found_or_private_auth_required:acme\/private: run 'gh auth login' or set GH_TOKEN\/GITHUB_TOKEN/,
  );
});

test("resolved auth token is attached to GitHub requests without being exposed elsewhere", async () => {
  let authorization = null;
  const reader = new GitHubReader({
    limit: 1,
    authResolver: () => ({ token: "secret-token", source: "gh_cli" }),
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return response({ full_name: "acme/private", default_branch: "main" });
    },
  });

  await reader.request("/repos/acme/private");
  assert.equal(authorization, "Bearer secret-token");
  assert.equal(reader.authSource, "gh_cli");
});
