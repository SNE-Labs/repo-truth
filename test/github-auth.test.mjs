import test from "node:test";
import assert from "node:assert/strict";
import { resolveGitHubToken } from "../src/github-auth.mjs";

test("environment token wins without invoking gh", () => {
  let invoked = false;
  const result = resolveGitHubToken({
    env: { GITHUB_TOKEN: "github-token", GH_TOKEN: "gh-token" },
    execFile: () => {
      invoked = true;
      return "cli-token";
    },
  });
  assert.deepEqual(result, { token: "github-token", source: "GITHUB_TOKEN" });
  assert.equal(invoked, false);
});

test("GH_TOKEN is accepted when GITHUB_TOKEN is absent", () => {
  const result = resolveGitHubToken({
    env: { GH_TOKEN: "gh-token" },
    execFile: () => "cli-token",
  });
  assert.deepEqual(result, { token: "gh-token", source: "GH_TOKEN" });
});

test("authenticated gh CLI is used as a local fallback", () => {
  const result = resolveGitHubToken({
    env: {},
    cwd: "C:\\repo",
    execFile: (command, args, options) => {
      assert.equal(command, "gh");
      assert.deepEqual(args, ["auth", "token"]);
      assert.equal(options.cwd, "C:\\repo");
      return "gho_example\n";
    },
  });
  assert.deepEqual(result, { token: "gho_example", source: "gh_cli" });
});

test("missing or unauthenticated gh CLI leaves the reader unauthenticated", () => {
  const result = resolveGitHubToken({
    env: {},
    execFile: () => {
      throw new Error("gh_not_found");
    },
  });
  assert.deepEqual(result, { token: null, source: "none" });
});
