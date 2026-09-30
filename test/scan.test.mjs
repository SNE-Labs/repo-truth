import test from "node:test";
import assert from "node:assert/strict";
import { compileScan, explainIssue, readyIssues } from "../src/scan.mjs";

const repository = {
  full_name: "acme/repo",
  updated_at: "2026-09-30T00:00:00Z",
};

const issues = [
  {
    number: 1,
    title: "Ship cache",
    body: "Depends on Issue #2",
    state: "open",
    labels: [],
    updated_at: "2026-09-30T00:00:00Z",
    html_url: "https://github.com/acme/repo/issues/1",
  },
  {
    number: 2,
    title: "Prerequisite",
    body: "",
    state: "closed",
    labels: [],
    updated_at: "2026-09-29T00:00:00Z",
    html_url: "https://github.com/acme/repo/issues/2",
  },
];

test("authority-backed live work with satisfied dependency becomes agent-ready", () => {
  const report = compileScan({
    repository,
    issues,
    pulls: [],
    commits: [],
    authorityPaths: ["ROADMAP.md"],
    documents: [
      {
        path: "ROADMAP.md",
        content: "Issue #1 is the current implementation.",
      },
    ],
    configPresent: true,
  });

  const detail = explainIssue(report, 1);
  assert.equal(detail.truth.classification, "live");
  assert.equal(detail.eligibility.eligible, true);
  assert.deepEqual(readyIssues(report).map(row => row.source_number), [1]);
  assert.equal(report.summary.agent_ready_issues, 1);
  assert.equal(Object.values(report.summary.truth).reduce((sum, value) => sum + value, 0), report.summary.open_issues);
  assert.equal(report.summary.all_task_truth.absorbed, 0);
});

test("provider-open state alone remains unknown and is never promoted into ready work", () => {
  const report = compileScan({
    repository,
    issues,
    pulls: [],
    commits: [],
  });

  const detail = explainIssue(report, 1);
  assert.equal(detail.truth.classification, "unknown");
  assert.equal(detail.truth.membership, "unresolved");
  assert.equal(detail.eligibility, null);
  assert.equal(report.summary.agent_ready_issues, 0);
  assert.equal(report.summary.truth.unknown, report.summary.open_issues);
  assert.equal(Object.values(report.summary.truth).reduce((sum, value) => sum + value, 0), report.summary.open_issues);
});

test("scan preserves bounded observation coverage without presenting it as repository total", () => {
  const report = compileScan({
    repository,
    issues,
    pulls: [],
    commits: [],
    coverage: {
      requested_limit: 2,
      observed_issue_roots: 2,
      issues_truncated: true,
      observed_pull_requests: 0,
      pulls_truncated: false,
      observed_commits: 2,
      commits_truncated: true,
    },
  });

  assert.equal(report.source.coverage.issues_truncated, true);
  assert.equal(report.source.coverage.observed_issue_roots, 2);
  assert.equal(report.summary.open_issues_observed, 1);
});

test("open Pull Request truth is summarized separately from open Issues", () => {
  const pulls = [
    {
      number: 7,
      title: "Already materialized",
      body: "",
      state: "open",
      head: { sha: "pr7-head" },
      updated_at: "2026-09-30T00:00:00Z",
      html_url: "https://github.com/acme/repo/pull/7",
    },
    {
      number: 8,
      title: "Still unresolved",
      body: "",
      state: "open",
      head: { sha: "pr8-head" },
      updated_at: "2026-09-30T00:00:00Z",
      html_url: "https://github.com/acme/repo/pull/8",
    },
  ];
  const commits = [
    { sha: "main-tip", parents: [{ sha: "pr7-head" }] },
  ];

  const report = compileScan({
    repository,
    issues: [],
    pulls,
    commits,
  });

  assert.equal(report.summary.open_pull_requests_observed, 2);
  assert.equal(report.summary.open_pull_truth.absorbed, 1);
  assert.equal(report.summary.open_pull_truth.unknown, 1);
  assert.equal(report.summary.open_pull_absorbed, 1);
  assert.equal(report.summary.open_pull_unresolved, 1);
  assert.equal(
    Object.values(report.summary.open_pull_truth).reduce((sum, value) => sum + value, 0),
    2,
  );
});
