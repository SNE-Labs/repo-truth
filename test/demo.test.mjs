import test from "node:test";
import assert from "node:assert/strict";
import { compileScan, explainIssue, readyIssues } from "../src/scan.mjs";
import {
  demoAuthorityPaths,
  demoDocuments,
  demoIssues,
  demoRepository,
} from "../demo/fixture.mjs";

test("demo fixture proves ready superseded and fenced states", () => {
  const report = compileScan({
    repository: demoRepository,
    issues: demoIssues,
    pulls: [],
    commits: [],
    authorityPaths: demoAuthorityPaths,
    documents: demoDocuments,
    configPresent: true,
  });

  assert.equal(explainIssue(report, 1).truth.classification, "live");
  assert.equal(explainIssue(report, 1).eligibility.eligible, true);

  assert.equal(explainIssue(report, 2).truth.classification, "superseded");
  assert.equal(explainIssue(report, 2).eligibility, null);

  assert.equal(explainIssue(report, 3).truth.classification, "live");
  assert.equal(explainIssue(report, 3).eligibility.eligible, false);

  assert.deepEqual(readyIssues(report).map(row => row.source_number), [1, 4]);
});
