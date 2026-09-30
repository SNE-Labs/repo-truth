const CLASSIFICATIONS = new Set([
  "live",
  "blocked",
  "superseded",
  "absorbed",
  "historical",
  "abandoned",
  "unknown",
]);

const OPEN_TASK_STATES = new Set(["active", "blocked", "review", "waiting"]);

const AUTHORITY_WEIGHT = Object.freeze({
  canonical_default_branch: 500,
  default_branch_material: 400,
  accepted_merge: 300,
  explicit_relation: 200,
  provider_state: 100,
});

function stableText(value) {
  return value == null ? "" : String(value).trim();
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function subjectOf(task) {
  return {
    task_id: stableText(task?.id) || null,
    source_kind: stableText(task?.source_kind) || null,
    source_number: positiveInteger(task?.source_number),
  };
}

function sameSubject(task, claim) {
  const subject = claim?.subject ?? {};
  if (subject.task_id) return stableText(subject.task_id) === stableText(task.id);
  const number = positiveInteger(subject.source_number);
  if (!number || !subject.source_kind) return false;
  return stableText(subject.source_kind) === stableText(task.source_kind)
    && number === positiveInteger(task.source_number);
}

function validateClaim(claim) {
  const classification = stableText(claim?.classification);
  const authority = stableText(claim?.authority);
  if (!CLASSIFICATIONS.has(classification)) throw new Error(`repository_truth_classification_invalid:${classification || "missing"}`);
  if (!(authority in AUTHORITY_WEIGHT)) throw new Error(`repository_truth_authority_invalid:${authority || "missing"}`);
  if (authority === "provider_state" && classification !== "unknown") {
    throw new Error("repository_truth_provider_state_cannot_assert_membership");
  }
  if (!claim?.subject?.task_id && !(claim?.subject?.source_kind && positiveInteger(claim?.subject?.source_number))) {
    throw new Error("repository_truth_claim_subject_invalid");
  }
  return {
    classification,
    authority,
    authority_weight: AUTHORITY_WEIGHT[authority],
    reason: stableText(claim.reason) || null,
    source: stableText(claim.source) || null,
    locator: stableText(claim.locator) || null,
    observed_at: stableText(claim.observed_at) || null,
  };
}

function compareClaims(a, b) {
  return b.authority_weight - a.authority_weight
    || String(a.classification).localeCompare(String(b.classification))
    || String(a.source ?? "").localeCompare(String(b.source ?? ""))
    || String(a.locator ?? "").localeCompare(String(b.locator ?? ""))
    || String(a.reason ?? "").localeCompare(String(b.reason ?? ""))
    || String(a.observed_at ?? "").localeCompare(String(b.observed_at ?? ""));
}

function resolveCandidate(task, claims) {
  const relevant = claims
    .filter(claim => sameSubject(task, claim.raw))
    .map(claim => claim.normalized)
    .sort(compareClaims);

  const providerFact = {
    authority: "provider_state",
    authority_weight: AUTHORITY_WEIGHT.provider_state,
    state: stableText(task.state) || null,
    source_kind: stableText(task.source_kind) || null,
    source_number: positiveInteger(task.source_number),
    updated_at: stableText(task.updated_at) || null,
  };

  if (!relevant.length) {
    return {
      ...subjectOf(task),
      task_state: stableText(task.state) || null,
      classification: "unknown",
      membership: OPEN_TASK_STATES.has(task.state) ? "unresolved" : "excluded",
      decisive_authority: null,
      decisive_weight: 0,
      conflict: false,
      reasons: ["provider-state-insufficient"],
      claims: [],
      provider_fact: providerFact,
    };
  }

  const highestWeight = relevant[0].authority_weight;
  const decisiveClaims = relevant.filter(claim => claim.authority_weight === highestWeight);
  const decisiveClasses = [...new Set(decisiveClaims.map(claim => claim.classification))].sort();

  if (decisiveClasses.length !== 1) {
    return {
      ...subjectOf(task),
      task_state: stableText(task.state) || null,
      classification: "unknown",
      membership: OPEN_TASK_STATES.has(task.state) ? "unresolved" : "excluded",
      decisive_authority: decisiveClaims[0]?.authority ?? null,
      decisive_weight: highestWeight,
      conflict: true,
      reasons: ["equal-authority-conflict", ...decisiveClasses.map(value => `claim:${value}`)],
      claims: relevant,
      provider_fact: providerFact,
    };
  }

  let classification = decisiveClasses[0];
  const reasons = decisiveClaims
    .map(claim => claim.reason || `${claim.authority}:${claim.classification}`)
    .filter(Boolean);

  // Operational blockage may narrow an already-proven live membership, but it
  // can never create live membership on its own.
  if (classification === "live" && task.state === "blocked") {
    classification = "blocked";
    reasons.push("operational-blocked-after-live-admission");
  }

  const admitted = OPEN_TASK_STATES.has(task.state) && (classification === "live" || classification === "blocked");
  const unresolved = OPEN_TASK_STATES.has(task.state) && classification === "unknown";

  return {
    ...subjectOf(task),
    task_state: stableText(task.state) || null,
    classification,
    membership: admitted ? "admitted" : unresolved ? "unresolved" : "excluded",
    decisive_authority: decisiveClaims[0]?.authority ?? null,
    decisive_weight: highestWeight,
    conflict: false,
    reasons: [...new Set(reasons)],
    claims: relevant,
    provider_fact: providerFact,
  };
}

function countByClassification(candidates) {
  const counts = {};
  for (const classification of CLASSIFICATIONS) counts[classification] = 0;
  for (const candidate of candidates) counts[candidate.classification] += 1;
  return counts;
}

export function compileRepositoryTruth({ repository, tasks = [], claims = [] }) {
  const fullName = stableText(repository?.full_name);
  if (!fullName.includes("/")) throw new Error("repository_truth_repository_required");

  const normalizedClaims = claims.map(claim => ({ raw: claim, normalized: validateClaim(claim) }));
  const candidates = [...tasks]
    .map(task => resolveCandidate(task, normalizedClaims))
    .sort((a, b) => String(a.task_id).localeCompare(String(b.task_id)));

  return {
    version: "repository-truth.v1",
    repository: fullName,
    authority: "evidence_reconciliation",
    authority_order: Object.entries(AUTHORITY_WEIGHT)
      .sort((a, b) => b[1] - a[1])
      .map(([authority]) => authority),
    candidates,
    admitted_task_ids: candidates.filter(candidate => candidate.membership === "admitted").map(candidate => candidate.task_id),
    unresolved_task_ids: candidates.filter(candidate => candidate.membership === "unresolved").map(candidate => candidate.task_id),
    excluded_task_ids: candidates.filter(candidate => candidate.membership === "excluded").map(candidate => candidate.task_id),
    counts: countByClassification(candidates),
    conflicts: candidates.filter(candidate => candidate.conflict).map(candidate => candidate.task_id),
  };
}

export function admitRepositoryTruthCandidates({ truth, tasks = [] }) {
  if (truth?.version !== "repository-truth.v1") throw new Error("repository_truth_v1_required");
  const admitted = new Set(truth.admitted_task_ids ?? []);
  return tasks.filter(task => admitted.has(task.id));
}

export const REPOSITORY_TRUTH_CLASSIFICATIONS = Object.freeze([...CLASSIFICATIONS]);
export const REPOSITORY_TRUTH_AUTHORITY = AUTHORITY_WEIGHT;