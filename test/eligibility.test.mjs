import test from "node:test";
import assert from "node:assert/strict";
import { compileTaskEligibility } from "../src/core/eligibility.mjs";

function task(id, state = "active", title = id) { return { id, state, title }; }
function dep(id, taskId, dependsOnTaskId, kind = "hard") { return { id, task_id: taskId, depends_on_task_id: dependsOnTaskId, kind, origin: "explicit", reason: "test" }; }

test("hard dependency fences an open Task until the prerequisite is done", () => {
  const a = task("a");
  const b = task("b", "active");
  const projection = compileTaskEligibility({ repository: "acme/repo", tasks: [a,b], dependencies: [dep("d1","a","b")] });
  assert.equal(projection.by_task_id.a.eligible, false);
  assert.equal(projection.by_task_id.a.reason, "hard-dependency-unresolved");
  assert.equal(projection.by_task_id.a.unresolved_hard_dependencies[0].task_id, "b");
});

test("done prerequisite satisfies a hard dependency", () => {
  const a = task("a");
  const b = task("b", "done");
  const projection = compileTaskEligibility({ repository: "acme/repo", tasks: [a,b], dependencies: [dep("d1","a","b")] });
  assert.equal(projection.by_task_id.a.eligible, true);
  assert.equal(projection.by_task_id.a.reason, "hard-dependencies-satisfied");
});

test("cancelled prerequisite does not satisfy a hard dependency", () => {
  const a = task("a");
  const b = task("b", "cancelled");
  const projection = compileTaskEligibility({ repository: "acme/repo", tasks: [a,b], dependencies: [dep("d1","a","b")] });
  assert.equal(projection.by_task_id.a.eligible, false);
  assert.equal(projection.by_task_id.a.unresolved_hard_dependencies[0].state, "cancelled");
  assert.equal(projection.invariants.cancelled_does_not_satisfy_hard_dependency, true);
});

test("soft dependency never fences eligibility", () => {
  const a = task("a");
  const b = task("b", "active");
  const projection = compileTaskEligibility({ repository: "acme/repo", tasks: [a,b], dependencies: [dep("d1","a","b","soft")] });
  assert.equal(projection.by_task_id.a.eligible, true);
  assert.equal(projection.by_task_id.a.hard_dependencies, 0);
});

test("terminal Task is never eligible even without dependencies", () => {
  const projection = compileTaskEligibility({ repository: "acme/repo", tasks: [task("done","done"), task("cancelled","cancelled")] });
  assert.equal(projection.by_task_id.done.eligible, false);
  assert.equal(projection.by_task_id.cancelled.eligible, false);
  assert.equal(projection.summary.terminal, 2);
});

test("truth-scoped candidate set evaluates only admitted candidates while observing prerequisites outside scope", () => {
  const admitted = task("live");
  const prerequisite = task("historical-prerequisite", "active");
  const unrelated = task("not-admitted", "active");
  const projection = compileTaskEligibility({
    repository: "acme/repo",
    tasks: [admitted, prerequisite, unrelated],
    dependencies: [dep("d1", admitted.id, prerequisite.id)],
    candidateTaskIds: [admitted.id],
    scopeSource: "repository-truth.v1",
  });
  assert.deepEqual(projection.scope.evaluated_task_ids, [admitted.id]);
  assert.equal(projection.scope.source, "repository-truth.v1");
  assert.equal(projection.by_task_id[unrelated.id], undefined);
  assert.equal(projection.by_task_id[admitted.id].eligible, false);
  assert.equal(projection.by_task_id[admitted.id].unresolved_hard_dependencies[0].task_id, prerequisite.id);
  assert.equal(projection.invariants.candidate_scope_does_not_limit_prerequisite_observation, true);
});

test("ambiguous or missing dependency references fail closed", () => {
  const a = task("a");
  const dependencyProjection = {
    version: "task-dependencies.v1",
    dependencies: [],
    rejected: [],
    unresolved_references: [
      {
        id: "u1",
        task_id: "a",
        kind: "hard",
        origin: "explicit",
        reason: "explicit-depends-on",
        rejected_reason: "ambiguous_bare_reference",
        evidence: { reference_number: 9, reference_kind: null },
      },
    ],
  };
  const projection = compileTaskEligibility({
    repository: "acme/repo",
    tasks: [a],
    dependencyProjection,
    candidateTaskIds: [a.id],
    scopeSource: "repository-truth.v1",
  });
  assert.equal(projection.by_task_id.a.eligible, false);
  assert.equal(projection.by_task_id.a.reason, "hard-dependency-unresolved");
  assert.equal(projection.by_task_id.a.unresolved_hard_dependencies[0].state, "ambiguous_bare_reference");
  assert.equal(projection.invariants.ambiguous_dependency_reference_fences_eligibility, true);
  assert.equal(projection.invariants.missing_dependency_reference_fences_eligibility, true);
});

test("rejected dependency cycle remains a causal fence instead of disappearing", () => {
  const a = task("a");
  const b = task("b");
  const dependencyProjection = {
    version: "task-dependencies.v1",
    dependencies: [dep("d1", "a", "b")],
    rejected: [{ ...dep("d2", "b", "a"), rejected_reason: "cycle" }],
    unresolved_references: [],
  };
  const projection = compileTaskEligibility({
    repository: "acme/repo",
    tasks: [a,b],
    dependencyProjection,
    candidateTaskIds: [b.id],
    scopeSource: "repository-truth.v1",
  });
  assert.equal(projection.by_task_id.b.eligible, false);
  assert.equal(projection.by_task_id.b.unresolved_hard_dependencies[0].state, "cycle");
  assert.equal(projection.invariants.rejected_dependency_cycle_fences_eligibility, true);
});