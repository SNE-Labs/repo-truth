import test from "node:test";
import assert from "node:assert/strict";
import {
  repositoryFromRemote,
  resolveRepositoryTarget,
} from "../src/repository-target.mjs";

test("repository target accepts owner/name and GitHub URLs", () => {
  assert.equal(resolveRepositoryTarget("openai/codex"), "openai/codex");
  assert.equal(
    resolveRepositoryTarget("https://github.com/openai/codex"),
    "openai/codex",
  );
  assert.equal(
    resolveRepositoryTarget("https://github.com/openai/codex.git"),
    "openai/codex",
  );
});

test("repository target resolves current git origin", () => {
  const execFile = (command, args, options) => {
    assert.equal(command, "git");
    assert.deepEqual(args, ["config", "--get", "remote.origin.url"]);
    assert.equal(options.cwd, "/tmp/project");
    return "git@github.com:SNE-Labs/repo-truth.git\n";
  };
  assert.equal(
    resolveRepositoryTarget(".", { cwd: "/tmp/project", execFile }),
    "SNE-Labs/repo-truth",
  );
});

test("GitHub remote parser accepts https scp and ssh forms", () => {
  assert.equal(
    repositoryFromRemote("https://github.com/SNE-Labs/repo-truth.git"),
    "SNE-Labs/repo-truth",
  );
  assert.equal(
    repositoryFromRemote("git@github.com:SNE-Labs/repo-truth.git"),
    "SNE-Labs/repo-truth",
  );
  assert.equal(
    repositoryFromRemote("ssh://git@github.com/SNE-Labs/repo-truth.git"),
    "SNE-Labs/repo-truth",
  );
  assert.throws(() => repositoryFromRemote("https://gitlab.com/acme/repo.git"));
});
