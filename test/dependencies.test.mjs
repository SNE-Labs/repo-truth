import test from "node:test";
import assert from "node:assert/strict";
import { compileTaskDependencies } from "../src/core/dependencies.mjs";

function task(id, kind, number, state = "active", parent = null) {
  return { id, repo: "acme/repo", source_kind: kind, source_number: number, parent_source_number: parent, state };
}

test("unresolved checklist requirements become structural hard dependencies of the Issue root", () => {
  const root = task("issue-1", "issue", 1);
  const open = task("check-open", "issue_checklist", 1, "active", 1);
  const done = task("check-done", "issue_checklist", 1, "done", 1);
  const projection = compileTaskDependencies({ repository: "acme/repo", tasks: [root, open, done] });
  assert.equal(projection.dependencies.length, 1);
  const row = projection.dependencies[0];
  assert.equal(row.task_id, root.id);
  assert.equal(row.depends_on_task_id, open.id);
  assert.equal(row.kind, "hard");
  assert.equal(row.origin, "structural");
  assert.equal(row.reason, "issue-checklist-requirement");
});

test("explicit blocked-by / depends-on / requires references become hard dependencies", () => {
  const a = task("issue-1", "issue", 1);
  const b = task("issue-2", "issue", 2);
  const c = task("pr-3", "pull_request", 3);
  const projection = compileTaskDependencies({
    repository: "acme/repo",
    tasks: [a, b, c],
    issues: [{ number: 1, title: "A", body: "Blocked by #2" }, { number: 2, title: "B", body: "" }],
    pulls: [{ number: 3, title: "C", body: "Depends on issue #2" }],
  });
  assert.equal(projection.dependencies.length, 2);
  assert.ok(projection.dependencies.every(row => row.kind === "hard" && row.origin === "explicit"));
  assert.ok(projection.dependencies.some(row => row.task_id === a.id && row.depends_on_task_id === b.id));
  assert.ok(projection.dependencies.some(row => row.task_id === c.id && row.depends_on_task_id === b.id));
});

test("typed dependency references preserve Issue versus PR identity", () => {
  const source = task("issue-1", "issue", 1);
  const issue9 = task("issue-9", "issue", 9);
  const pr9 = task("pr-9", "pull_request", 9);
  const projection = compileTaskDependencies({
    repository: "acme/repo",
    tasks: [source, issue9, pr9],
    issues: [{ number: 1, title: "A", body: "Depends on PR #9" }, { number: 9, title: "Issue 9", body: "" }],
    pulls: [{ number: 9, title: "PR 9", body: "" }],
  });
  assert.equal(projection.dependencies.length, 1);
  assert.equal(projection.dependencies[0].depends_on_task_id, "pr-9");
  assert.equal(projection.dependencies[0].evidence.reference_kind, "pull_request");
  assert.equal(projection.provenance.typed_reference_preserves_source_kind, true);
});

test("ambiguous bare dependency reference is preserved as unresolved instead of resolving issue-first", () => {
  const source = task("issue-1", "issue", 1);
  const issue9 = task("issue-9", "issue", 9);
  const pr9 = task("pr-9", "pull_request", 9);
  const projection = compileTaskDependencies({
    repository: "acme/repo",
    tasks: [source, issue9, pr9],
    issues: [{ number: 1, title: "A", body: "Depends on #9" }, { number: 9, title: "Issue 9", body: "" }],
    pulls: [{ number: 9, title: "PR 9", body: "" }],
  });
  assert.equal(projection.dependencies.length, 0);
  assert.equal(projection.unresolved_references.length, 1);
  assert.equal(projection.unresolved_references[0].rejected_reason, "ambiguous_bare_reference");
  assert.equal(projection.provenance.ambiguous_bare_reference_resolves, false);
});

test("missing dependency reference is preserved for fail-closed eligibility", () => {
  const source = task("issue-1", "issue", 1);
  const projection = compileTaskDependencies({
    repository: "acme/repo",
    tasks: [source],
    issues: [{ number: 1, title: "A", body: "Requires Issue #404" }],
  });
  assert.equal(projection.dependencies.length, 0);
  assert.equal(projection.unresolved_references.length, 1);
  assert.equal(projection.unresolved_references[0].rejected_reason, "missing_typed_reference");
  assert.equal(projection.provenance.missing_reference_is_ignored, false);
});

test("fenced code examples in provider bodies cannot create hard dependencies", () => {
  const a = task("issue-1", "issue", 1);
  const b = task("issue-2", "issue", 2);
  const projection = compileTaskDependencies({
    repository: "acme/repo",
    tasks: [a, b],
    issues: [
      { number: 1, title: "A", body: "Example only:\n```text\nDepends on Issue #2\n```\nNo causal relation is declared." },
      { number: 2, title: "B", body: "" },
    ],
  });
  assert.equal(projection.dependencies.length, 0);
  assert.equal(projection.unresolved_references.length, 0);
  assert.equal(projection.provenance.fenced_code_blocks_authoritative, false);
});

test("GitHub closure references remain relationships and are not promoted to dependencies", () => {
  const issue = task("issue-1", "issue", 1);
  const pr = task("pr-2", "pull_request", 2);
  const projection = compileTaskDependencies({
    repository: "acme/repo",
    tasks: [issue, pr],
    issues: [{ number: 1, title: "Issue", body: "" }],
    pulls: [{ number: 2, title: "Implementation", body: "Fixes #1" }],
  });
  assert.equal(projection.dependencies.length, 0);
  assert.equal(projection.provenance.closure_references_are_dependencies, false);
});

test("self dependencies are ignored and cycles are deterministically rejected", () => {
  const a = task("issue-a", "issue", 1);
  const b = task("issue-b", "issue", 2);
  const projection = compileTaskDependencies({
    repository: "acme/repo",
    tasks: [a, b],
    issues: [
      { number: 1, title: "A", body: "Depends on #1 and blocked by #2" },
      { number: 2, title: "B", body: "Requires #1" },
    ],
  });
  assert.equal(projection.dependencies.length, 1);
  assert.equal(projection.rejected.length, 1);
  assert.equal(projection.rejected[0].rejected_reason, "cycle");
  assert.notEqual(projection.dependencies[0].task_id, projection.dependencies[0].depends_on_task_id);
});

test("dependency projection remains read-only and snapshot-derived", () => {
  const projection = compileTaskDependencies({ repository: "acme/repo", tasks: [] });
  assert.equal(projection.version, "task-dependencies.v1");
  assert.equal(projection.source, "durable_snapshots");
  assert.equal(projection.authority, "read_only_projection");
});