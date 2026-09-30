import { compileScan, explainIssue, readyIssues } from "../src/scan.mjs";
import {
  demoAuthorityPaths,
  demoDocuments,
  demoIssues,
  demoRepository,
} from "./fixture.mjs";

const report = compileScan({
  repository: demoRepository,
  issues: demoIssues,
  pulls: [],
  commits: [],
  authorityPaths: demoAuthorityPaths,
  documents: demoDocuments,
  configPresent: true,
});

console.log("repo-truth demo");
console.log("");
for (const number of [1, 2, 3, 4]) {
  const detail = explainIssue(report, number);
  const truth = String(detail.truth?.classification ?? "unknown").toUpperCase();
  const eligibility = detail.eligibility?.eligible
    ? "READY"
    : detail.eligibility
      ? "FENCED"
      : "DO NOT START";
  console.log("#" + number + "  " + truth.padEnd(10) + "  " + eligibility.padEnd(12) + "  " + detail.task.title);
}
console.log("");
console.log("verified ready: " + readyIssues(report).map(row => "#" + row.source_number).join(", "));
