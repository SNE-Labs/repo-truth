import { projectRepository } from "./core/projector.mjs";
import { compileTaskDependencies } from "./core/dependencies.mjs";
import { compileTaskEligibility } from "./core/eligibility.mjs";
import { compileRepositoryTruth } from "./core/repository-truth.mjs";
import { compileRepositoryTruthEvidence } from "./core/truth-evidence.mjs";
import { GitHubReader } from "./github-reader.mjs";

const SYNTHETIC_AUTHORITY_MAP = ".repo-truth-authority.md";
const TRUTH_CLASSES = [
  "live",
  "blocked",
  "superseded",
  "absorbed",
  "historical",
  "abandoned",
  "unknown",
];

function authorityMap(paths) {
  return {
    path: SYNTHETIC_AUTHORITY_MAP,
    content: ["## Canonical current documents", "", ...paths.map(path => "- `" + path + "`")].join("\n"),
  };
}

function countReadyIssues(tasks, eligibility) {
  const ready = new Set(eligibility.eligible_task_ids ?? []);
  return tasks.filter(task => task.source_kind === "issue" && ready.has(task.id)).length;
}

function countOpenIssueTruth(tasks, truth) {
  const byTask = new Map(truth.candidates.map(candidate => [candidate.task_id, candidate]));
  const counts = Object.fromEntries(TRUTH_CLASSES.map(key => [key, 0]));
  for (const task of tasks) {
    if (task.source_kind !== "issue") continue;
    if (task.state === "done" || task.state === "cancelled") continue;
    const classification = byTask.get(task.id)?.classification ?? "unknown";
    counts[classification] = (counts[classification] ?? 0) + 1;
  }
  return counts;
}

export function compileScan({
  repository,
  issues = [],
  pulls = [],
  commits = [],
  documents = [],
  authorityPaths = [],
  configPresent = false,
}) {
  const projection = projectRepository({ repository, issues, pulls, commits });
  const evidenceDocuments = authorityPaths.length
    ? [authorityMap(authorityPaths), ...documents]
    : [];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks: projection.tasks,
    documents: evidenceDocuments,
    issues,
    pulls,
    commits,
    authorityMapPath: SYNTHETIC_AUTHORITY_MAP,
  });
  const truth = compileRepositoryTruth({
    repository,
    tasks: projection.tasks,
    claims: evidence.claims,
  });
  const dependencies = compileTaskDependencies({
    repository: repository.full_name,
    tasks: projection.tasks,
    issues,
    pulls,
  });
  const eligibility = compileTaskEligibility({
    repository: repository.full_name,
    tasks: projection.tasks,
    dependencyProjection: dependencies,
    candidateTaskIds: truth.admitted_task_ids,
    scopeSource: "repository-truth.v1",
  });
  const openIssues = issues.filter(row => row.state === "open").length;
  const openPulls = pulls.filter(row => row.state === "open").length;
  const openIssueTruth = countOpenIssueTruth(projection.tasks, truth);
  const agentReadyIssues = countReadyIssues(projection.tasks, eligibility);

  return {
    version: "repo-truth.scan.v0",
    repository: repository.full_name,
    source: {
      config_present: configPresent,
      authority_paths: authorityPaths,
    },
    summary: {
      open_issues: openIssues,
      open_pull_requests: openPulls,
      truth: openIssueTruth,
      all_task_truth: truth.counts,
      admitted: truth.admitted_task_ids.length,
      unresolved: truth.unresolved_task_ids.length,
      excluded: truth.excluded_task_ids.length,
      agent_ready: eligibility.eligible_task_ids.length,
      agent_ready_issues: agentReadyIssues,
      open_issue_unresolved: openIssueTruth.unknown,
      fenced: eligibility.fenced_task_ids.length,
    },
    tasks: projection.tasks,
    attention: projection.attention,
    evidence,
    truth,
    dependencies,
    eligibility,
  };
}

export async function scanRepository(repo, { reader = null, limit = 200 } = {}) {
  const source = reader ?? new GitHubReader({ limit });
  return compileScan(await source.load(repo, { limit }));
}

export function explainIssue(report, number) {
  const numeric = Number(number);
  if (!Number.isSafeInteger(numeric) || numeric < 1) throw new Error("issue_number_invalid");
  const task = report.tasks.find(
    row => row.source_kind === "issue" && Number(row.source_number) === numeric,
  );
  if (!task) return null;
  const truth = report.truth.candidates.find(row => row.task_id === task.id) ?? null;
  const eligibility = report.eligibility.by_task_id[task.id] ?? null;
  return { task, truth, eligibility };
}

export function readyIssues(report) {
  const ready = new Set(report.eligibility.eligible_task_ids ?? []);
  return report.tasks.filter(
    task => task.source_kind === "issue" && ready.has(task.id),
  );
}
