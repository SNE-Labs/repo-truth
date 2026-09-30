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