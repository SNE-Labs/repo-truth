import { GitHubReader } from "./github-reader.mjs";
import { resolveRepositoryTarget } from "./repository-target.mjs";
import { explainIssue, readyIssues, scanRepository } from "./scan.mjs";

function usage() {
  return [
    "repo-truth — compile GitHub into work a coding agent can actually start",
    "",
    "Usage:",
    "  repo-truth scan owner/repo [--limit 200] [--json]",
    "  repo-truth scan . [--limit 200] [--json]",
    "  repo-truth scan https://github.com/owner/repo [--limit 200] [--json]",
    "  repo-truth next owner/repo [--limit 200] [--json]",
    "  repo-truth explain owner/repo#42 [--limit 200] [--json]",
    "",
    "Authentication:",
    "  Set GITHUB_TOKEN or GH_TOKEN for higher rate limits and private repositories.",
  ].join("\n");
}

function argumentsOf(argv) {
  let json = false;
  let limit = 200;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--json") json = true;
    else if (value === "--limit") {
      limit = Number(argv[++index]);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
        throw new Error("limit_must_be_integer_1_to_1000");
      }
    } else {
      positional.push(value);
    }
  }
  return { json, limit, positional };
}

function truthLine(counts, key) {
  return "  " + String(counts[key] ?? 0).padStart(4) + "  " + key.toUpperCase();
}

function formatScan(report) {
  const counts = report.summary.truth;
  const coverage = report.source.coverage ?? {};
  const issueWindow = String(coverage.observed_issue_roots ?? report.tasks.length) +
    " issue roots observed" + (coverage.issues_truncated ? " · truncated" : "");
  const pullWindow = String(coverage.observed_pull_requests ?? 0) +
    " pull requests observed" + (coverage.pulls_truncated ? " · truncated" : "");
  return [
    "repo-truth · " + report.repository,
    "",
    "Observed GitHub window",
    "  " + issueWindow,
    "  " + report.summary.open_issues_observed + " open issues in observed window",
    "  " + pullWindow,
    "  " + report.summary.open_pull_requests_observed + " open pull requests in observed window",
    "",
    "Repository truth",
    truthLine(counts, "live"),
    truthLine(counts, "blocked"),
    truthLine(counts, "superseded"),
    truthLine(counts, "absorbed"),
    truthLine(counts, "historical"),
    truthLine(counts, "abandoned"),
    truthLine(counts, "unknown"),
    "",
    "Authority",
    report.source.config_present
      ? "  canonical documents: " + report.source.authority_paths.length + " configured"
      : "  no .repo-truth.json configured",
    report.source.config_present
      ? "  OPEN still requires explicit repository evidence"
      : "  provider OPEN cannot promote work to LIVE",
    "",
    "Agent eligibility",
    "  " + report.summary.agent_ready_issues + " verified agent-ready issues",
    "  " + report.summary.fenced + " admitted tasks fenced",
    "  " + report.summary.open_issue_unresolved + " open issues truth unresolved",
    "",
    "OPEN ≠ ACTIONABLE",
    report.summary.open_issues_observed + " observed open issues → " + report.summary.agent_ready_issues + " verified agent-ready",
  ].join("\n");
}

function formatNext(report) {
  const rows = readyIssues(report);
  if (!rows.length) {
    return [
      "repo-truth · " + report.repository,
      "",
      "No verified agent-ready issues.",
      report.summary.unresolved + " tasks remain unresolved because repository truth is not proven.",
    ].join("\n");
  }
  return [
    "repo-truth · " + report.repository,
    "",
    "Verified agent-ready work",
    "",
    ...rows.map(row => "#" + row.source_number + "  " + row.title),
    "",
    rows.length + " of " + report.summary.open_issues_observed + " observed open issues are verified ready.",
  ].join("\n");
}

function formatExplain(repo, number, detail) {
  if (!detail) {
    return "Issue #" + number + " was not found in the bounded scan of " + repo + ".";
  }
  const candidate = detail.truth;
  const claims = candidate?.claims ?? [];
  const lines = [
    "Issue #" + number,
    detail.task.title,
    "",
    "GitHub",
    "  " + String(detail.task.state ?? "unknown").toUpperCase(),
    "",
    "Repository truth",
    "  " + String(candidate?.classification ?? "unknown").toUpperCase(),
    "  membership: " + String(candidate?.membership ?? "unresolved"),
  ];
  if (claims.length) {
    lines.push("", "Evidence");
    for (const claim of claims) {
      lines.push(
        "  " + claim.authority + " · " + claim.classification + " · " +
        (claim.reason ?? claim.source ?? "evidence"),
      );
      if (claim.locator) lines.push("    " + claim.locator);
    }
  }
  lines.push("", "Agent eligibility");
  if (!detail.eligibility) lines.push("  NOT ADMITTED");
  else if (detail.eligibility.eligible) lines.push("  READY");
  else {
    lines.push("  FENCED · " + detail.eligibility.reason);
    for (const row of detail.eligibility.unresolved_hard_dependencies ?? []) {
      lines.push("    " + row.title + " · " + row.state);
    }
  }
  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2), io = console) {
  const parsed = argumentsOf(argv);
  if (!parsed.positional.length || parsed.positional.includes("--help") || parsed.positional.includes("-h")) {
    io.log(usage());
    return 0;
  }

  const commands = new Set(["scan", "next", "explain"]);
  const first = parsed.positional[0];
  const command = commands.has(first) ? first : "scan";
  const target = commands.has(first) ? parsed.positional[1] : first;
  if (!target) throw new Error("repository_required");
  const reader = new GitHubReader({ limit: parsed.limit });

  if (command === "explain") {
    const match = /^(.+)#(\d+)$/.exec(target);
    if (!match) throw new Error("explain_target_must_be_owner_slash_repo_hash_number");
    const repo = resolveRepositoryTarget(match[1]);
    const number = Number(match[2]);
    const report = await scanRepository(repo, { reader, limit: parsed.limit });
    const detail = explainIssue(report, number);
    io.log(parsed.json ? JSON.stringify(detail, null, 2) : formatExplain(repo, number, detail));
    return 0;
  }

  const repo = resolveRepositoryTarget(target);
  const report = await scanRepository(repo, { reader, limit: parsed.limit });
  if (parsed.json) {
    io.log(JSON.stringify(command === "next" ? readyIssues(report) : report, null, 2));
  } else {
    io.log(command === "next" ? formatNext(report) : formatScan(report));
  }
  return 0;
}

export async function run(argv = process.argv.slice(2)) {
  try {
    return await main(argv);
  } catch (error) {
    console.error("repo-truth: " + (error instanceof Error ? error.message : String(error)));
    return 1;
  }
}