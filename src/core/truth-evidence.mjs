import { stripFencedAuthorityExamples } from "./authority-text.mjs";
import { posix as path } from "node:path";

const NEGATIVE_CLASSIFICATIONS = Object.freeze({
  superseded: "superseded",
  supersedes: "superseded",
  replaced: "superseded",
  replaces: "superseded",
  historical: "historical",
  abandoned: "abandoned",
  absorbed: "absorbed",
  absorbs: "absorbed",
});

function text(value) {
  return value == null ? "" : String(value);
}

function normalizedText(value) {
  return text(value).trim();
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function sourceKind(value) {
  const normalized = normalizedText(value).toLowerCase().replace(/[\s_-]+/g, " ");
  if (normalized === "pr" || normalized === "pull request" || normalized === "pull") return "pull_request";
  if (normalized === "issue") return "issue";
  return null;
}

function sourceLabel(kind) {
  return kind === "pull_request" ? "PR" : kind === "issue" ? "Issue" : kind;
}

function subject(kind, number, taskBySource, uniqueByNumber) {
  const numeric = positiveInteger(number);
  if (!numeric) return null;
  if (kind) {
    const task = taskBySource.get(`${kind}:${numeric}`);
    return task ? { task_id: task.id, source_kind: kind, source_number: numeric } : null;
  }
  const candidates = uniqueByNumber.get(numeric) ?? [];
  return candidates.length === 1
    ? { task_id: candidates[0].id, source_kind: candidates[0].source_kind, source_number: numeric }
    : null;
}

function indexTasks(tasks) {
  const taskBySource = new Map();
  const uniqueByNumber = new Map();
  for (const task of tasks) {
    const number = positiveInteger(task.source_number);
    if (!number || !["issue", "pull_request"].includes(task.source_kind)) continue;
    taskBySource.set(`${task.source_kind}:${number}`, task);
    const rows = uniqueByNumber.get(number) ?? [];
    rows.push(task);
    uniqueByNumber.set(number, rows);
  }
  return { taskBySource, uniqueByNumber };
}

function resolveRelativeDocument(authorityMapPath, rawPath) {
  const clean = normalizedText(rawPath).replace(/\\/g, "/");
  if (!clean) return null;
  const base = path.dirname(authorityMapPath || "docs/README.md");
  const resolved = path.normalize(path.join(base, clean));
  if (resolved.startsWith("../") || resolved === "..") return null;
  return resolved.replace(/^\.\//, "");
}

export function extractCanonicalDocumentPaths(documents = [], { authorityMapPath = "docs/README.md" } = {}) {
  const mapDocument = documents.find(document => document.path === authorityMapPath);
  if (!mapDocument?.content) return [];
  const lines = stripFencedAuthorityExamples(text(mapDocument.content)).split(/\r?\n/);
  let inside = false;
  const canonical = new Set([authorityMapPath]);
  for (const line of lines) {
    if (/^##\s+Canonical current documents\s*$/i.test(line.trim())) {
      inside = true;
      continue;
    }
    if (inside && /^##\s+/.test(line.trim())) break;
    if (!inside) continue;
    for (const match of line.matchAll(/`([^`]+\.(?:md|mdx|txt))`/gi)) {
      const resolved = resolveRelativeDocument(authorityMapPath, match[1]);
      if (resolved) canonical.add(resolved);
    }
  }
  return [...canonical].sort();
}

function claim({ subject: claimSubject, classification, authority, reason, source, locator = null, observedAt = null, evidence = null }) {
  return {
    subject: claimSubject,
    classification,
    authority,
    reason,
    source,
    locator,
    observed_at: observedAt,
    evidence,
  };
}

function addClaim(rows, value) {
  if (!value?.subject?.task_id || !value.classification || !value.authority) return;
  rows.push(value);
}

function extractCanonicalDeclarations({ document, taskBySource, uniqueByNumber }) {
  const claims = [];
  const lines = stripFencedAuthorityExamples(text(document.content)).split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const compact = line.trim();
    if (!compact) continue;

    // "Current implementation: PR #16" / "Active continuation — Issue #8"
    const leading = /\b(current|active|live)(?:\s+(?:implementation|continuation|work|roadmap|frontier))?\s*[:=—–-]\s*(PR|pull\s+request|Issue)\s*#(\d+)\b/i.exec(compact);
    if (leading) {
      const kind = sourceKind(leading[2]);
      const target = subject(kind, leading[3], taskBySource, uniqueByNumber);
      addClaim(claims, target && claim({
        subject: target,
        classification: "live",
        authority: "canonical_default_branch",
        reason: "explicit-canonical-current",
        source: `document:${document.path}`,
        locator: `${document.path}:${index + 1}`,
        evidence: compact,
      }));
    }

    // "PR #16 is the current implementation" / "Issue #8 remains active continuation"
    const trailing = /\b(PR|pull\s+request|Issue)\s*#(\d+)\b[^\n]{0,80}\b(?:is|remains|=)\s+(?:the\s+)?(?:current|active|live)(?:\s+(?:implementation|continuation|work|roadmap|frontier))?\b/i.exec(compact);
    if (trailing) {
      const kind = sourceKind(trailing[1]);
      const target = subject(kind, trailing[2], taskBySource, uniqueByNumber);
      addClaim(claims, target && claim({
        subject: target,
        classification: "live",
        authority: "canonical_default_branch",
        reason: "explicit-canonical-current",
        source: `document:${document.path}`,
        locator: `${document.path}:${index + 1}`,
        evidence: compact,
      }));
    }

    // "PR #4 is historical/superseded/absorbed/abandoned"
    const state = /\b(PR|pull\s+request|Issue)\s*#(\d+)\b[^\n]{0,60}\b(?:is|=|remains)\s+(?:explicitly\s+)?(superseded|historical|absorbed|abandoned)\b/i.exec(compact);
    if (state) {
      const kind = sourceKind(state[1]);
      const target = subject(kind, state[2], taskBySource, uniqueByNumber);
      addClaim(claims, target && claim({
        subject: target,
        classification: NEGATIVE_CLASSIFICATIONS[state[3].toLowerCase()],
        authority: "canonical_default_branch",
        reason: `explicit-canonical-${state[3].toLowerCase()}`,
        source: `document:${document.path}`,
        locator: `${document.path}:${index + 1}`,
        evidence: compact,
      }));
    }
  }
  return claims;
}

function explicitRelationsFromText({ value, source, locatorPrefix, taskBySource, uniqueByNumber, authority = "explicit_relation" }) {
  const claims = [];
  const lines = stripFencedAuthorityExamples(text(value)).split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const compact = line.trim();
    if (!compact) continue;

    // "PR #16 supersedes/replaces/absorbs PR #4"
    const forward = /\b(PR|pull\s+request|Issue)\s*#(\d+)\b[^\n]{0,60}\b(supersedes|replaces|absorbs)\s+(?:(PR|pull\s+request|Issue)\s*)?#(\d+)\b/i.exec(compact);
    if (forward) {
      const targetKind = sourceKind(forward[4]);
      const target = subject(targetKind, forward[5], taskBySource, uniqueByNumber);
      addClaim(claims, target && claim({
        subject: target,
        classification: NEGATIVE_CLASSIFICATIONS[forward[3].toLowerCase()],
        authority,
        reason: `explicit-${forward[3].toLowerCase()}`,
        source,
        locator: `${locatorPrefix}:${index + 1}`,
        evidence: compact,
      }));
    }

    // "PR #4 is superseded/replaced/absorbed by PR #16"
    const reverse = /\b(PR|pull\s+request|Issue)\s*#(\d+)\b[^\n]{0,40}\b(?:is|was|has\s+been)\s+(superseded|replaced|absorbed)\s+by\s+(?:(PR|pull\s+request|Issue)\s*)?#(\d+)\b/i.exec(compact);
    if (reverse) {
      const target = subject(sourceKind(reverse[1]), reverse[2], taskBySource, uniqueByNumber);
      addClaim(claims, target && claim({
        subject: target,
        classification: NEGATIVE_CLASSIFICATIONS[reverse[3].toLowerCase()],
        authority,
        reason: `explicit-${reverse[3].toLowerCase()}-by`,
        source,
        locator: `${locatorPrefix}:${index + 1}`,
        evidence: compact,
      }));
    }

    // "Historical: PR #4" / "Abandoned — Issue #9"
    const labelled = /\b(historical|abandoned|superseded|absorbed)\s*[:=—–-]\s*(?:(PR|pull\s+request|Issue)\s*)?#(\d+)\b/i.exec(compact);
    if (labelled) {
      const target = subject(sourceKind(labelled[2]), labelled[3], taskBySource, uniqueByNumber);
      addClaim(claims, target && claim({
        subject: target,
        classification: NEGATIVE_CLASSIFICATIONS[labelled[1].toLowerCase()],
        authority,
        reason: `explicit-${labelled[1].toLowerCase()}-label`,
        source,
        locator: `${locatorPrefix}:${index + 1}`,
        evidence: compact,
      }));
    }
  }
  return claims;
}

function closureIssueNumbers(pull) {
  const rows = new Set();
  const value = `${pull.title ?? ""}\n${pull.body ?? ""}`;
  for (const match of value.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:issue\s*)?#(\d+)\b/gi)) {
    const number = positiveInteger(match[1]);
    if (number) rows.add(number);
  }
  return [...rows].sort((a, b) => a - b);
}

function acceptedMergeClaims({ pulls, taskBySource, uniqueByNumber }) {
  const claims = [];
  for (const pull of pulls) {
    if (!(pull.merged === true || pull.merged_at)) continue;
    const number = positiveInteger(pull.number);
    const pullSubject = subject("pull_request", number, taskBySource, uniqueByNumber);
    addClaim(claims, pullSubject && claim({
      subject: pullSubject,
      classification: "absorbed",
      authority: "accepted_merge",
      reason: "pull-request-merged",
      source: `pull_request:${number}`,
      locator: pull.html_url ?? null,
      observedAt: pull.merged_at ?? pull.updated_at ?? null,
      evidence: { merged_at: pull.merged_at ?? null, merge_commit_sha: pull.merge_commit_sha ?? null },
    }));

    for (const issueNumber of closureIssueNumbers(pull)) {
      const issueSubject = subject("issue", issueNumber, taskBySource, uniqueByNumber);
      addClaim(claims, issueSubject && claim({
        subject: issueSubject,
        classification: "absorbed",
        authority: "accepted_merge",
        reason: "merged-pull-closes-issue",
        source: `pull_request:${number}`,
        locator: pull.html_url ?? null,
        observedAt: pull.merged_at ?? pull.updated_at ?? null,
        evidence: { pull_number: number, issue_number: issueNumber },
      }));
    }
  }
  return claims;
}

function defaultBranchMaterialClaims({ pulls, commits, taskBySource, uniqueByNumber }) {
  const claims = [];
  const reachable = new Set();
  for (const commit of commits) {
    if (commit?.sha) reachable.add(commit.sha);
    for (const parent of commit?.parents ?? []) {
      const sha = typeof parent === "string" ? parent : parent?.sha;
      if (sha) reachable.add(sha);
    }
  }
  for (const pull of pulls) {
    if (pull.merged === true || pull.merged_at) continue;
    const headSha = pull.head?.sha ?? pull.head_sha ?? null;
    if (!headSha || !reachable.has(headSha)) continue;
    const number = positiveInteger(pull.number);
    const target = subject("pull_request", number, taskBySource, uniqueByNumber);
    addClaim(claims, target && claim({
      subject: target,
      classification: "absorbed",
      authority: "default_branch_material",
      reason: "pull-head-reachable-from-default-branch-window",
      source: "default_branch:commits",
      locator: headSha,
      observedAt: pull.updated_at ?? null,
      evidence: { pull_number: number, head_sha: headSha },
    }));
  }
  return claims;
}

function canonicalDocumentClaims({ documents, canonicalPaths, taskBySource, uniqueByNumber }) {
  const claims = [];
  const canonicalSet = new Set(canonicalPaths);
  for (const document of documents) {
    if (!canonicalSet.has(document.path)) continue;
    claims.push(...extractCanonicalDeclarations({ document, taskBySource, uniqueByNumber }));
    claims.push(...explicitRelationsFromText({
      value: document.content,
      source: `document:${document.path}`,
      locatorPrefix: document.path,
      taskBySource,
      uniqueByNumber,
      authority: "canonical_default_branch",
    }));
  }
  return claims;
}

function githubObjectRelationClaims({ issues, pulls, taskBySource, uniqueByNumber }) {
  const claims = [];
  for (const issue of issues) {
    const number = positiveInteger(issue.number);
    claims.push(...explicitRelationsFromText({
      value: `${issue.title ?? ""}\n${issue.body ?? ""}`,
      source: `issue:${number}`,
      locatorPrefix: `issue:${number}`,
      taskBySource,
      uniqueByNumber,
    }));
  }
  for (const pull of pulls) {
    const number = positiveInteger(pull.number);
    claims.push(...explicitRelationsFromText({
      value: `${pull.title ?? ""}\n${pull.body ?? ""}`,
      source: `pull_request:${number}`,
      locatorPrefix: `pull_request:${number}`,
      taskBySource,
      uniqueByNumber,
    }));
  }
  return claims;
}

function stableClaimKey(value) {
  return [
    value.subject?.task_id,
    value.classification,
    value.authority,
    value.reason,
    value.source,
    value.locator,
  ].map(part => part ?? "").join("\0");
}

function sortClaims(a, b) {
  return String(a.subject?.task_id).localeCompare(String(b.subject?.task_id))
    || String(a.authority).localeCompare(String(b.authority))
    || String(a.classification).localeCompare(String(b.classification))
    || String(a.source).localeCompare(String(b.source))
    || String(a.locator ?? "").localeCompare(String(b.locator ?? ""));
}

export function compileRepositoryTruthEvidence({
  repository,
  tasks = [],
  documents = [],
  issues = [],
  pulls = [],
  commits = [],
  authorityMapPath = "docs/README.md",
}) {
  const repo = normalizedText(typeof repository === "string" ? repository : repository?.full_name);
  if (!repo.includes("/")) throw new Error("truth_evidence_repository_required");
  const { taskBySource, uniqueByNumber } = indexTasks(tasks);
  const canonicalDocuments = extractCanonicalDocumentPaths(documents, { authorityMapPath });

  const candidates = [
    ...canonicalDocumentClaims({ documents, canonicalPaths: canonicalDocuments, taskBySource, uniqueByNumber }),
    ...githubObjectRelationClaims({ issues, pulls, taskBySource, uniqueByNumber }),
    ...acceptedMergeClaims({ pulls, taskBySource, uniqueByNumber }),
    ...defaultBranchMaterialClaims({ pulls, commits, taskBySource, uniqueByNumber }),
  ];

  const unique = new Map();
  for (const row of candidates) unique.set(stableClaimKey(row), row);
  const claims = [...unique.values()].sort(sortClaims);

  return {
    version: "truth-evidence.v1",
    repository: repo,
    source: "durable_repository_evidence",
    authority_map_path: authorityMapPath,
    canonical_documents: canonicalDocuments,
    claims,
    counts: claims.reduce((acc, row) => {
      acc[row.authority] = (acc[row.authority] ?? 0) + 1;
      return acc;
    }, {}),
    provenance: {
      live_requires_explicit_canonical_object_declaration: true,
      recency_promotes_live: false,
      semantic_inference_authoritative: false,
      accepted_merge_can_promote_live: false,
      relation_can_promote_successor_live: false,
      source_labels: { pull_request: sourceLabel("pull_request"), issue: sourceLabel("issue") },
    },
  };
}