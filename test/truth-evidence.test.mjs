import test from "node:test";
import assert from "node:assert/strict";
import { compileRepositoryTruth } from "../src/core/repository-truth.mjs";
import {
  compileRepositoryTruthEvidence,
  extractCanonicalDocumentPaths,
} from "../src/core/truth-evidence.mjs";

const repository = { full_name: "example/reality" };

function task(id, sourceKind, sourceNumber, state = "active") {
  return { id, source_kind: sourceKind, source_number: sourceNumber, state, updated_at: "2026-09-01T12:00:00Z" };
}

function authorityMap(paths = ["CURRENT.md"]) {
  return {
    path: "docs/README.md",
    content: `# Authority\n\n## Canonical current documents\n\n${paths.map((value, index) => `${index + 1}. \`${value}\``).join("\n")}\n\n## Historical commissioning records\n\n- old.md`,
  };
}

test("authority map resolves canonical documents relative to its own path", () => {
  const documents = [
    authorityMap(["CURRENT.md", "../README.md"]),
    { path: "docs/CURRENT.md", content: "Current implementation: PR #16" },
    { path: "README.md", content: "Overview" },
  ];
  assert.deepEqual(
    extractCanonicalDocumentPaths(documents),
    ["README.md", "docs/CURRENT.md", "docs/README.md"],
  );
});

test("explicit current declaration in canonical document emits live claim", () => {
  const tasks = [task("task_pr16", "pull_request", 16)];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    documents: [
      authorityMap(),
      { path: "docs/CURRENT.md", content: "Current implementation: PR #16" },
    ],
  });
  assert.equal(evidence.claims.length, 1);
  assert.equal(evidence.claims[0].subject.task_id, "task_pr16");
  assert.equal(evidence.claims[0].classification, "live");
  assert.equal(evidence.claims[0].authority, "canonical_default_branch");
});

test("same current wording in a non-canonical document cannot promote live", () => {
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks: [task("task_pr16", "pull_request", 16)],
    documents: [
      authorityMap(["CURRENT.md"]),
      { path: "docs/CURRENT.md", content: "No object declaration here." },
      { path: "docs/NOTES.md", content: "Current implementation: PR #16" },
    ],
  });
  assert.deepEqual(evidence.claims, []);
});

test("canonical historical declaration excludes stale open PR while current declaration admits successor", () => {
  const tasks = [
    task("task_pr4", "pull_request", 4, "active"),
    task("task_pr16", "pull_request", 16, "active"),
  ];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    documents: [
      authorityMap(),
      {
        path: "docs/CURRENT.md",
        content: "PR #4 is historical.\nCurrent implementation: PR #16",
      },
    ],
  });
  const truth = compileRepositoryTruth({ repository, tasks, claims: evidence.claims });
  assert.equal(truth.candidates.find(row => row.task_id === "task_pr4").classification, "historical");
  assert.equal(truth.candidates.find(row => row.task_id === "task_pr16").classification, "live");
  assert.deepEqual(truth.admitted_task_ids, ["task_pr16"]);
});

test("explicit supersession from PR text excludes target without promoting source", () => {
  const tasks = [
    task("task_old", "pull_request", 4),
    task("task_new", "pull_request", 16),
  ];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    pulls: [{ number: 16, title: "GFC", body: "PR #16 supersedes PR #4", state: "open" }],
  });
  assert.equal(evidence.claims.length, 1);
  assert.equal(evidence.claims[0].subject.task_id, "task_old");
  assert.equal(evidence.claims[0].classification, "superseded");
  assert.equal(evidence.claims[0].authority, "explicit_relation");

  const truth = compileRepositoryTruth({ repository, tasks, claims: evidence.claims });
  assert.equal(truth.candidates.find(row => row.task_id === "task_new").classification, "unknown");
  assert.deepEqual(truth.admitted_task_ids, []);
});

test("merged pull is absorbed and may absorb explicitly closed Issue", () => {
  const tasks = [
    task("task_pr20", "pull_request", 20, "done"),
    task("task_issue21", "issue", 21, "active"),
  ];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    pulls: [{
      number: 20,
      title: "Ship implementation",
      body: "Closes #21",
      merged: true,
      merged_at: "2026-09-01T13:00:00Z",
      merge_commit_sha: "merge20",
      html_url: "https://github.com/example/reality/pull/20",
    }],
  });
  assert.deepEqual(
    evidence.claims.map(row => [row.subject.task_id, row.classification, row.authority]).sort(),
    [
      ["task_issue21", "absorbed", "accepted_merge"],
      ["task_pr20", "absorbed", "accepted_merge"],
    ],
  );
});

test("open PR head reachable from default-branch commit window is material absorption evidence", () => {
  const tasks = [task("task_pr12", "pull_request", 12, "active")];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    pulls: [{ number: 12, state: "open", head: { sha: "head12" } }],
    commits: [{ sha: "merge-ish", parents: [{ sha: "head12" }, { sha: "base" }] }],
  });
  assert.equal(evidence.claims.length, 1);
  assert.equal(evidence.claims[0].classification, "absorbed");
  assert.equal(evidence.claims[0].authority, "default_branch_material");
});

test("recency and open provider state alone emit no truth claims", () => {
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks: [
      task("task_old", "pull_request", 4),
      task("task_recent", "pull_request", 16),
    ],
    pulls: [
      { number: 4, state: "open", updated_at: "2026-01-01T00:00:00Z" },
      { number: 16, state: "open", updated_at: "2026-09-01T17:00:00Z" },
    ],
  });
  assert.deepEqual(evidence.claims, []);
  assert.equal(evidence.provenance.recency_promotes_live, false);
});

test("ambiguous bare reference is ignored instead of guessed", () => {
  const tasks = [
    task("task_issue9", "issue", 9),
    task("task_pr9", "pull_request", 9),
    task("task_pr10", "pull_request", 10),
  ];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    pulls: [{ number: 10, body: "PR #10 supersedes #9", state: "open" }],
  });
  assert.deepEqual(evidence.claims, []);
});

test("canonical contradiction is preserved for RepositoryTruth conflict handling", () => {
  const tasks = [task("task_pr16", "pull_request", 16)];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    documents: [
      authorityMap(["A.md", "B.md"]),
      { path: "docs/A.md", content: "Current implementation: PR #16" },
      { path: "docs/B.md", content: "PR #16 is historical" },
    ],
  });
  assert.equal(evidence.claims.length, 2);
  const truth = compileRepositoryTruth({ repository, tasks, claims: evidence.claims });
  assert.equal(truth.candidates[0].classification, "unknown");
  assert.equal(truth.candidates[0].conflict, true);
});

test("evidence extraction is order-independent", () => {
  const tasks = [task("task_pr4", "pull_request", 4), task("task_pr16", "pull_request", 16)];
  const documents = [
    authorityMap(["A.md", "B.md"]),
    { path: "docs/A.md", content: "Current implementation: PR #16" },
    { path: "docs/B.md", content: "Historical: PR #4" },
  ];
  const pulls = [
    { number: 16, body: "PR #16 supersedes PR #4", state: "open" },
    { number: 4, body: "", state: "open" },
  ];
  const left = compileRepositoryTruthEvidence({ repository, tasks, documents, pulls });
  const right = compileRepositoryTruthEvidence({
    repository,
    tasks: [...tasks].reverse(),
    documents: [...documents].reverse(),
    pulls: [...pulls].reverse(),
  });
  assert.deepEqual(left, right);
});

test("semantic-looking prose does not become authoritative evidence", () => {
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks: [task("task_pr16", "pull_request", 16)],
    documents: [
      authorityMap(),
      { path: "docs/CURRENT.md", content: "PR #16 is probably the thing we should work on next." },
    ],
    pulls: [{ number: 16, body: "This feels newer and more important than the older branch." }],
  });
  assert.deepEqual(evidence.claims, []);
  assert.equal(evidence.provenance.semantic_inference_authoritative, false);
});

test("fenced canonical examples cannot create live or historical truth", () => {
  const tasks = [
    task("task_pr4", "pull_request", 4),
    task("task_pr16", "pull_request", 16),
  ];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    documents: [
      authorityMap(),
      {
        path: "docs/CURRENT.md",
        content: [
          "# Current state",
          "",
          "```text",
          "Current implementation: PR #16",
          "PR #4 is historical",
          "```",
          "",
          "No concrete object declaration is made outside the example.",
        ].join("\n"),
      },
    ],
  });
  assert.deepEqual(evidence.claims, []);
});

test("fenced Issue and PR relation examples cannot exclude real tasks", () => {
  const tasks = [
    task("task_issue9", "issue", 9),
    task("task_pr4", "pull_request", 4),
    task("task_pr16", "pull_request", 16),
  ];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    issues: [{
      number: 9,
      title: "Contract examples",
      body: "```text\nHistorical: Issue #9\n```",
      state: "open",
    }],
    pulls: [{
      number: 16,
      title: "Contract examples",
      body: "```text\nPR #16 supersedes PR #4\n```",
      state: "open",
    }],
  });
  assert.deepEqual(evidence.claims, []);
});

test("authority map ignores fenced canonical-document examples", () => {
  const map = {
    path: "docs/README.md",
    content: [
      "# Authority",
      "",
      "```text",
      "## Canonical current documents",
      "1. `FAKE.md`",
      "```",
      "",
      "## Canonical current documents",
      "1. `REAL.md`",
    ].join("\n"),
  };
  assert.deepEqual(
    extractCanonicalDocumentPaths([map]),
    ["docs/README.md", "docs/REAL.md"],
  );
});

test("inline-code relation examples cannot create truth claims", () => {
  const tasks = [
    task("task_pr4", "pull_request", 4),
    task("task_pr16", "pull_request", 16),
  ];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    documents: [
      authorityMap(),
      {
        path: "docs/CURRENT.md",
        content: "Example only: `PR #16 supersedes PR #4` must not authorize repository truth.",
      },
    ],
  });
  assert.deepEqual(evidence.claims, []);
});

test("blockquote and html-comment examples cannot create truth claims", () => {
  const tasks = [
    task("task_pr4", "pull_request", 4),
    task("task_pr16", "pull_request", 16),
  ];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    documents: [
      authorityMap(),
      {
        path: "docs/CURRENT.md",
        content: [
          "> Current implementation: PR #16",
          "<!-- PR #16 supersedes PR #4 -->",
        ].join("\n"),
      },
    ],
  });
  assert.deepEqual(evidence.claims, []);
});

test("closure syntax inside fenced examples cannot absorb a real Issue", () => {
  const tasks = [
    task("task_pr20", "pull_request", 20, "done"),
    task("task_issue21", "issue", 21, "active"),
  ];
  const evidence = compileRepositoryTruthEvidence({
    repository,
    tasks,
    pulls: [{
      number: 20,
      title: "Documentation example",
      body: "```text\nCloses #21\n```",
      merged: true,
      merged_at: "2026-09-01T13:00:00Z",
      merge_commit_sha: "merge20",
    }],
  });
  assert.deepEqual(
    evidence.claims.map(row => [row.subject.task_id, row.classification, row.authority]),
    [["task_pr20", "absorbed", "accepted_merge"]],
  );
});
