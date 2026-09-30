import { createHash } from "node:crypto";
import { stripFencedAuthorityExamples } from "./authority-text.mjs";

function stableId(...parts) {
  return `dep_${createHash("sha256").update(parts.map(String).join("\0")).digest("hex").slice(0, 18)}`;
}

function sourceKey(kind, number) {
  return `${kind}:${Number(number)}`;
}

function normalizeReferenceKind(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (text === "issue") return "issue";
  if (text === "pr" || text === "pull request") return "pull_request";
  return null;
}

function explicitDependencyRefs(text = "") {
  const rows = [];
  const pattern = /\b(blocked\s+by|depends?\s+on|requires?)\s+(?:(issue|pr|pull\s+request)\s*)?#(\d+)\b/gi;
  for (const match of String(text).matchAll(pattern)) {
    const phrase = String(match[1]).toLowerCase().replace(/\s+/g, " ");
    rows.push({
      number: Number(match[3]),
      source_kind: normalizeReferenceKind(match[2]),
      reason: phrase.startsWith("blocked") ? "explicit-blocked-by" : phrase.startsWith("depend") ? "explicit-depends-on" : "explicit-requires",
      phrase: match[0],
    });
  }
  return rows;
}

function resolveReference(ref, taskBySource) {
  if (ref.source_kind) {
    const task = taskBySource.get(sourceKey(ref.source_kind, ref.number)) ?? null;
    return task
      ? { task, state: "resolved" }
      : { task: null, state: "missing_typed_reference" };
  }

  const matches = [
    taskBySource.get(sourceKey("issue", ref.number)) ?? null,
    taskBySource.get(sourceKey("pull_request", ref.number)) ?? null,
  ].filter(Boolean);
  if (matches.length === 1) return { task: matches[0], state: "resolved" };
  if (matches.length > 1) return { task: null, state: "ambiguous_bare_reference" };
  return { task: null, state: "missing_bare_reference" };
}

function wouldCycle(edges, taskId, dependsOnTaskId) {
  const adjacency = new Map();
  for (const edge of edges) {
    const rows = adjacency.get(edge.task_id) ?? [];
    rows.push(edge.depends_on_task_id);
    adjacency.set(edge.task_id, rows);
  }
  const stack = [dependsOnTaskId];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of adjacency.get(current) ?? []) stack.push(next);
  }
  return false;
}

function candidate({ repository, task, prerequisite, origin, reason, evidence }) {
  return {
    id: stableId(repository, task.id, prerequisite.id, "hard"),
    repository,
    task_id: task.id,
    depends_on_task_id: prerequisite.id,
    kind: "hard",
    origin,
    confidence: 1,
    reason,
    evidence,
  };
}

function unresolvedReference({ repository, task, ref, object, rejectedReason }) {
  return {
    id: stableId(repository, task.id, object.kind, object.number, ref.source_kind ?? "bare", ref.number, rejectedReason),
    repository,
    task_id: task.id,
    kind: "hard",
    origin: "explicit",
    reason: ref.reason,
    evidence: {
      source_kind: object.kind,
      source_number: object.number,
      reference_kind: ref.source_kind,
      reference_number: ref.number,
      phrase: ref.phrase,
    },
    rejected_reason: rejectedReason,
  };
}

export function compileTaskDependencies({ repository, tasks = [], issues = [], pulls = [] }) {
  const repo = typeof repository === "string" ? repository : repository?.full_name;
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const taskBySource = new Map();
  for (const task of tasks) {
    if (task.source_number == null) continue;
    if (task.source_kind === "issue") taskBySource.set(sourceKey("issue", task.source_number), task);
    if (task.source_kind === "pull_request") taskBySource.set(sourceKey("pull_request", task.source_number), task);
  }

  const candidates = [];
  const unresolvedReferences = [];

  // An Issue root is not operationally complete while one of its projected checklist
  // requirements remains unresolved. This is a structural hard dependency, not an
  // inference from visual ordering.
  for (const root of tasks.filter(task => task.source_kind === "issue")) {
    for (const child of tasks.filter(task => task.source_kind === "issue_checklist" && Number(task.parent_source_number) === Number(root.source_number) && !["done", "cancelled"].includes(task.state))) {
      candidates.push(candidate({
        repository: repo,
        task: root,
        prerequisite: child,
        origin: "structural",
        reason: "issue-checklist-requirement",
        evidence: { issue_number: Number(root.source_number), checklist_task_id: child.id },
      }));
    }
  }

  const objects = [
    ...issues.map(issue => ({ kind: "issue", number: Number(issue.number), title: issue.title, body: issue.body })),
    ...pulls.map(pull => ({ kind: "pull_request", number: Number(pull.number), title: pull.title, body: pull.body })),
  ];
  for (const object of objects) {
    const task = taskBySource.get(sourceKey(object.kind, object.number));
    if (!task) continue;
    const authorityText = `${object.title ?? ""}\n${stripFencedAuthorityExamples(object.body ?? "")}`;
    for (const ref of explicitDependencyRefs(authorityText)) {
      const resolution = resolveReference(ref, taskBySource);
      const prerequisite = resolution.task;
      if (!prerequisite) {
        unresolvedReferences.push(unresolvedReference({
          repository: repo,
          task,
          ref,
          object,
          rejectedReason: resolution.state,
        }));
        continue;
      }
      if (prerequisite.id === task.id) continue;
      candidates.push(candidate({
        repository: repo,
        task,
        prerequisite,
        origin: "explicit",
        reason: ref.reason,
        evidence: {
          source_kind: object.kind,
          source_number: object.number,
          reference_kind: ref.source_kind,
          reference_number: ref.number,
          phrase: ref.phrase,
        },
      }));
    }
  }

  const unique = new Map();
  for (const row of candidates) unique.set(`${row.task_id}\0${row.depends_on_task_id}\0${row.kind}`, row);
  const ordered = [...unique.values()].sort((a, b) =>
    String(a.task_id).localeCompare(String(b.task_id)) ||
    String(a.depends_on_task_id).localeCompare(String(b.depends_on_task_id)) ||
    String(a.reason).localeCompare(String(b.reason))
  );

  const dependencies = [];
  const rejected = [];
  for (const row of ordered) {
    if (!taskById.has(row.task_id) || !taskById.has(row.depends_on_task_id)) continue;
    if (wouldCycle(dependencies, row.task_id, row.depends_on_task_id)) {
      rejected.push({ ...row, rejected_reason: "cycle" });
      continue;
    }
    dependencies.push(row);
  }

  unresolvedReferences.sort((a, b) =>
    String(a.task_id).localeCompare(String(b.task_id)) ||
    Number(a.evidence?.reference_number ?? 0) - Number(b.evidence?.reference_number ?? 0) ||
    String(a.rejected_reason).localeCompare(String(b.rejected_reason))
  );

  return {
    version: "task-dependencies.v1",
    repository: repo,
    source: "durable_snapshots",
    authority: "read_only_projection",
    dependencies,
    rejected,
    unresolved_references: unresolvedReferences,
    provenance: {
      explicit_patterns: ["blocked by #N", "depends on #N", "requires #N"],
      structural_rules: ["unresolved issue checklist requirement"],
      closure_references_are_dependencies: false,
      fenced_code_blocks_authoritative: false,
      typed_reference_preserves_source_kind: true,
      ambiguous_bare_reference_resolves: false,
      missing_reference_is_ignored: false,
    },
  };
}