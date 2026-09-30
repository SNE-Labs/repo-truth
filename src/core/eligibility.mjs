const TERMINAL_STATES = new Set(["done", "cancelled"]);

function unresolvedProjectionCause(row, taskById) {
  if (row.rejected_reason === "cycle") {
    const prerequisite = taskById.get(row.depends_on_task_id) ?? null;
    return {
      dependency_id: row.id,
      task_id: row.depends_on_task_id ?? null,
      title: prerequisite?.title ?? "Cyclic prerequisite",
      state: "cycle",
      origin: row.origin,
      reason: row.reason,
      rejected_reason: "cycle",
      evidence: row.evidence ?? null,
    };
  }
  const referenceKind = row.evidence?.reference_kind ?? null;
  const referenceNumber = row.evidence?.reference_number ?? null;
  const label = referenceKind === "pull_request"
    ? `PR #${referenceNumber}`
    : referenceKind === "issue"
      ? `Issue #${referenceNumber}`
      : `#${referenceNumber}`;
  return {
    dependency_id: row.id,
    task_id: null,
    title: `Unresolved prerequisite ${label}`,
    state: row.rejected_reason ?? "unresolved-reference",
    origin: row.origin,
    reason: row.reason,
    rejected_reason: row.rejected_reason ?? "unresolved-reference",
    evidence: row.evidence ?? null,
  };
}

export function compileTaskEligibility({
  repository,
  tasks = [],
  dependencies = [],
  dependencyProjection = null,
  candidateTaskIds = null,
  scopeSource = null,
}) {
  const repo = typeof repository === "string" ? repository : repository?.full_name;
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const resolvedDependencies = dependencyProjection?.version === "task-dependencies.v1"
    ? dependencyProjection.dependencies ?? []
    : dependencies;
  const projectionFailures = dependencyProjection?.version === "task-dependencies.v1"
    ? [
        ...(dependencyProjection.rejected ?? []).filter(row => row.kind === "hard"),
        ...(dependencyProjection.unresolved_references ?? []).filter(row => row.kind === "hard"),
      ]
    : [];

  const hardByTask = new Map();
  for (const dependency of resolvedDependencies.filter(row => row.kind === "hard")) {
    const rows = hardByTask.get(dependency.task_id) ?? [];
    rows.push(dependency);
    hardByTask.set(dependency.task_id, rows);
  }

  const failuresByTask = new Map();
  for (const failure of projectionFailures) {
    const rows = failuresByTask.get(failure.task_id) ?? [];
    rows.push(failure);
    failuresByTask.set(failure.task_id, rows);
  }

  const scopedIds = candidateTaskIds == null ? null : new Set(candidateTaskIds.map(String));
  const evaluatedTasks = scopedIds === null
    ? tasks
    : tasks.filter(task => scopedIds.has(String(task.id)));

  const rows = evaluatedTasks.map(task => {
    const hard = hardByTask.get(task.id) ?? [];
    const projectionFailureRows = failuresByTask.get(task.id) ?? [];
    const unresolvedResolvedEdges = hard.map(dependency => {
      const prerequisite = taskById.get(dependency.depends_on_task_id) ?? null;
      if (prerequisite?.state === "done") return null;
      return {
        dependency_id: dependency.id,
        task_id: dependency.depends_on_task_id,
        title: prerequisite?.title ?? "Missing prerequisite Task",
        state: prerequisite?.state ?? "missing",
        origin: dependency.origin,
        reason: dependency.reason,
        rejected_reason: null,
        evidence: dependency.evidence ?? null,
      };
    }).filter(Boolean);
    const unresolvedProjection = projectionFailureRows.map(row => unresolvedProjectionCause(row, taskById));
    const unresolved = [...unresolvedResolvedEdges, ...unresolvedProjection];

    const terminal = TERMINAL_STATES.has(task.state);
    const eligible = !terminal && unresolved.length === 0;
    return {
      task_id: task.id,
      task_state: task.state,
      eligible,
      reason: terminal
        ? "terminal-task"
        : unresolved.length
          ? "hard-dependency-unresolved"
          : hard.length
            ? "hard-dependencies-satisfied"
            : "no-hard-dependencies",
      hard_dependencies: hard.length + projectionFailureRows.length,
      resolved_hard_dependencies: hard.length,
      unresolved_hard_dependencies: unresolved,
    };
  });

  const byTaskId = Object.fromEntries(rows.map(row => [row.task_id, row]));
  return {
    version: "task-eligibility.v1",
    repository: repo,
    source: "task-dependencies.v1",
    authority: "read_only_projection",
    scope: {
      kind: scopedIds === null ? "all_tasks" : "explicit_candidate_set",
      source: scopeSource ?? null,
      candidate_task_ids: scopedIds === null ? null : [...scopedIds].sort(),
      evaluated_task_ids: rows.map(row => row.task_id),
    },
    tasks: rows,
    by_task_id: byTaskId,
    eligible_task_ids: rows.filter(row => row.eligible).map(row => row.task_id),
    fenced_task_ids: rows.filter(row => !row.eligible).map(row => row.task_id),
    summary: {
      evaluated: rows.length,
      eligible: rows.filter(row => row.eligible).length,
      fenced: rows.filter(row => !row.eligible && row.reason === "hard-dependency-unresolved").length,
      terminal: rows.filter(row => row.reason === "terminal-task").length,
    },
    invariants: {
      hard_dependency_requires_done: true,
      cancelled_does_not_satisfy_hard_dependency: true,
      soft_dependency_fences_eligibility: false,
      ambiguous_dependency_reference_fences_eligibility: true,
      missing_dependency_reference_fences_eligibility: true,
      rejected_dependency_cycle_fences_eligibility: true,
      candidate_scope_does_not_limit_prerequisite_observation: true,
    },
  };
}