import test from "node:test";
import assert from "node:assert/strict";
import {
  admitRepositoryTruthCandidates,
  compileRepositoryTruth,
} from "../src/core/repository-truth.mjs";

const repository = { full_name: "example/reality" };

function task(id, sourceKind, sourceNumber, state = "active") {
  return {
    id,
    source_kind: sourceKind,
    source_number: sourceNumber,
    state,
    updated_at: "2026-09-01T12:00:00Z",
  };
}

function claim(taskId, classification, authority, reason = null) {
  return {
    subject: { task_id: taskId },
    classification,
    authority,
    reason,
    source: `fixture:${authority}`,
  };
}

test("open provider state alone is unknown and never live", () => {
  const truth = compileRepositoryTruth({
    repository,
    tasks: [task("task_pr4", "pull_request", 4, "active")],
  });

  assert.equal(truth.candidates[0].classification, "unknown");
  assert.equal(truth.candidates[0].membership, "unresolved");
  assert.deepEqual(truth.admitted_task_ids, []);
  assert.deepEqual(truth.unresolved_task_ids, ["task_pr4"]);
});

test("canonical default-branch evidence can admit an open Task as live", () => {
  const truth = compileRepositoryTruth({
    repository,
    tasks: [task("task_pr16", "pull_request", 16, "active")],
    claims: [claim("task_pr16", "live", "canonical_default_branch", "canonical-current")],
  });

  assert.equal(truth.candidates[0].classification, "live");
  assert.equal(truth.candidates[0].membership, "admitted");
  assert.deepEqual(truth.admitted_task_ids, ["task_pr16"]);
});

test("provider blockage may narrow proven live membership but cannot create it", () => {
  const proven = compileRepositoryTruth({
    repository,
    tasks: [task("task_blocked", "pull_request", 9, "blocked")],
    claims: [claim("task_blocked", "live", "canonical_default_branch", "canonical-current")],
  });
  assert.equal(proven.candidates[0].classification, "blocked");
  assert.equal(proven.candidates[0].membership, "admitted");
  assert.ok(proven.candidates[0].reasons.includes("operational-blocked-after-live-admission"));

  const unproven = compileRepositoryTruth({
    repository,
    tasks: [task("task_unproven", "pull_request", 10, "blocked")],
  });
  assert.equal(unproven.candidates[0].classification, "unknown");
  assert.equal(unproven.candidates[0].membership, "unresolved");
});

test("explicit supersession excludes an older open object without promoting its successor", () => {
  const tasks = [
    task("task_old", "pull_request", 4, "active"),
    task("task_new", "pull_request", 16, "active"),
  ];
  const truth = compileRepositoryTruth({
    repository,
    tasks,
    claims: [claim("task_old", "superseded", "explicit_relation", "superseded-by-pr-16")],
  });

  const old = truth.candidates.find(candidate => candidate.task_id === "task_old");
  const newer = truth.candidates.find(candidate => candidate.task_id === "task_new");
  assert.equal(old.classification, "superseded");
  assert.equal(old.membership, "excluded");
  assert.equal(newer.classification, "unknown");
  assert.equal(newer.membership, "unresolved");
  assert.deepEqual(truth.admitted_task_ids, []);
});

test("stronger canonical evidence wins over lower-authority relation evidence", () => {
  const truth = compileRepositoryTruth({
    repository,
    tasks: [task("task_current", "issue", 21, "active")],
    claims: [
      claim("task_current", "superseded", "explicit_relation", "old-relation"),
      claim("task_current", "live", "canonical_default_branch", "canonical-current"),
    ],
  });

  assert.equal(truth.candidates[0].classification, "live");
  assert.equal(truth.candidates[0].decisive_authority, "canonical_default_branch");
});

test("equal-authority contradiction collapses to unknown instead of arbitrary selection", () => {
  const truth = compileRepositoryTruth({
    repository,
    tasks: [task("task_conflict", "pull_request", 18, "active")],
    claims: [
      claim("task_conflict", "live", "canonical_default_branch", "doc-a"),
      claim("task_conflict", "historical", "canonical_default_branch", "doc-b"),
    ],
  });

  assert.equal(truth.candidates[0].classification, "unknown");
  assert.equal(truth.candidates[0].membership, "unresolved");
  assert.equal(truth.candidates[0].conflict, true);
  assert.deepEqual(truth.conflicts, ["task_conflict"]);
});

test("truth reconciliation is order-independent", () => {
  const tasks = [
    task("task_a", "pull_request", 7, "active"),
    task("task_b", "issue", 8, "active"),
  ];
  const claims = [
    claim("task_a", "historical", "canonical_default_branch", "history-map"),
    claim("task_b", "live", "default_branch_material", "material-anchor"),
    claim("task_b", "superseded", "explicit_relation", "stale-relation"),
  ];

  const left = compileRepositoryTruth({ repository, tasks, claims });
  const right = compileRepositoryTruth({ repository, tasks: [...tasks].reverse(), claims: [...claims].reverse() });
  assert.deepEqual(left, right);
});

test("terminal Task cannot enter the admitted current candidate set even with live evidence", () => {
  const done = task("task_done", "pull_request", 3, "done");
  const truth = compileRepositoryTruth({
    repository,
    tasks: [done],
    claims: [claim("task_done", "live", "canonical_default_branch", "stale-canonical-claim")],
  });

  assert.equal(truth.candidates[0].classification, "live");
  assert.equal(truth.candidates[0].membership, "excluded");
  assert.deepEqual(admitRepositoryTruthCandidates({ truth, tasks: [done] }), []);
});

test("truth admission filters operational candidates without rewriting Task state", () => {
  const tasks = [
    task("task_live", "pull_request", 16, "review"),
    task("task_unknown", "pull_request", 4, "blocked"),
    task("task_history", "issue", 2, "active"),
  ];
  const truth = compileRepositoryTruth({
    repository,
    tasks,
    claims: [
      claim("task_live", "live", "canonical_default_branch", "current-implementation"),
      claim("task_history", "historical", "canonical_default_branch", "provenance-only"),
    ],
  });

  const admitted = admitRepositoryTruthCandidates({ truth, tasks });
  assert.deepEqual(admitted.map(item => item.id), ["task_live"]);
  assert.equal(tasks[0].state, "review");
  assert.equal(tasks[1].state, "blocked");
  assert.equal(tasks[2].state, "active");
});

test("provider_state authority cannot assert live roadmap membership", () => {
  assert.throws(
    () => compileRepositoryTruth({
      repository,
      tasks: [task("task_provider", "pull_request", 1, "active")],
      claims: [claim("task_provider", "live", "provider_state", "open-on-github")],
    }),
    /repository_truth_provider_state_cannot_assert_membership/,
  );
});