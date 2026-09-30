import { createHash } from "node:crypto";

function id(prefix, ...parts) {
  const digest = createHash("sha256").update(parts.map(String).join("\0")).digest("hex").slice(0, 18);
  return `${prefix}_${digest}`;
}

export function parseChecklist(body = "") {
  const rows = [];
  for (const [index, line] of String(body).split(/\r?\n/).entries()) {
    const match = /^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    rows.push({
      index,
      checked: match[1].toLowerCase() === "x",
      title: match[2].trim(),
    });
  }
  return rows;
}

function labelsOf(item) {
  return (item.labels ?? []).map(label => typeof label === "string" ? label : label?.name).filter(Boolean);
}

function normalizedKey(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "general";
}

export function inferFrontier(item) {
  if (item.milestone?.title) {
    return { key: `milestone:${normalizedKey(item.milestone.title)}`, title: item.milestone.title, reason: "milestone" };
  }

  for (const label of labelsOf(item)) {
    const match = /^(?:frontier|area|project|stream)\s*[:/]\s*(.+)$/i.exec(label);
    if (match) {
      return { key: `label:${normalizedKey(match[1])}`, title: match[1].trim(), reason: `label:${label}` };
    }
  }

  const title = String(item.title ?? "").trim();
  const bracket = /^\[([^\]]{2,60})\]\s*/.exec(title);
  if (bracket) {
    return { key: `title:${normalizedKey(bracket[1])}`, title: bracket[1].trim(), reason: "title-bracket" };
  }

  const coded = /^([A-Z][A-Z0-9]+(?:-[A-Z0-9]+){1,4})(?:\s*[:—–-]\s*|\s+)/.exec(title);
  if (coded) {
    return { key: `code:${normalizedKey(coded[1])}`, title: coded[1], reason: "title-code" };
  }

  const prefix = /^(.{3,48}?)(?:\s+—\s+|\s+–\s+|:\s+)/.exec(title);
  if (prefix && prefix[1].split(/\s+/).length <= 6) {
    return { key: `title:${normalizedKey(prefix[1])}`, title: prefix[1].trim(), reason: "title-prefix" };
  }

  return { key: "general", title: "General", reason: "fallback" };
}

function issueState(issue) {
  if (issue.state === "closed") return "done";
  const labels = labelsOf(issue).map(label => label.toLowerCase());
  if (labels.some(label => /\b(blocked|blocker)\b/.test(label))) return "blocked";
  if (labels.some(label => /\b(waiting|external|hold)\b/.test(label))) return "waiting";
  return "active";
}

function pullState(pull) {
  if (pull.merged_at || pull.merged === true) return "done";
  if (pull.state === "closed") return "cancelled";
  if (pull.draft) return "active";
  const checkState = pull._gflow_checks?.state;
  if (checkState === "failure") return "blocked";
  if (checkState === "success") return "review";
  return "active";
}

function referencedIssueNumbers(pull) {
  const text = `${pull.title ?? ""}\n${pull.body ?? ""}`;
  const numbers = new Set();
  for (const match of text.matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)?\s*#(\d+)/gi)) {
    numbers.add(Number(match[1]));
  }
  return [...numbers].filter(Number.isInteger);
}

function ageDays(value, now = Date.now()) {
  const parsed = Date.parse(value ?? "");
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, (now - parsed) / 86_400_000);
}

function taskPriority(state) {
  return ({ blocked: 0, review: 1, active: 2, waiting: 3, done: 4, cancelled: 5 })[state] ?? 9;
}

export function projectRepository({ repository, issues = [], pulls = [], commits = [] }, now = Date.now()) {
  const repo = repository.full_name;
  const frontierMap = new Map();
  const tasks = [];
  const attention = [];
  const issueFrontier = new Map();

  function ensureFrontier(descriptor, evidence = {}) {
    const frontierId = id("fr", repo, descriptor.key);
    if (!frontierMap.has(frontierId)) {
      frontierMap.set(frontierId, {
        id: frontierId,
        repo,
        key: descriptor.key,
        title: descriptor.title,
        state: "active",
        progress: 0,
        current_task_id: null,
        updated_at: repository.updated_at ?? new Date(now).toISOString(),
        evidence: { reasons: [descriptor.reason], ...evidence },
      });
    }
    return frontierMap.get(frontierId);
  }

  for (const issue of issues) {
    const descriptor = inferFrontier(issue);
    const frontier = ensureFrontier(descriptor, { source: "issue" });
    issueFrontier.set(Number(issue.number), frontier.id);
    const state = issueState(issue);
    const rootTaskId = id("task", repo, "issue", issue.number);
    tasks.push({
      id: rootTaskId,
      repo,
      frontier_id: frontier.id,
      source_kind: "issue",
      source_number: Number(issue.number),
      parent_source_number: null,
      title: issue.title,
      state,
      origin: "explicit",
      confidence: 1,
      position: 0,
      evidence: {
        html_url: issue.html_url,
        labels: labelsOf(issue),
        milestone: issue.milestone?.title ?? null,
        updated_at: issue.updated_at,
      },
      updated_at: issue.updated_at ?? repository.updated_at,
    });

    const checklist = parseChecklist(issue.body);
    for (const item of checklist) {
      const childState = item.checked ? "done" : issue.state === "closed" ? "cancelled" : state === "blocked" ? "blocked" : "active";
      tasks.push({
        id: id("task", repo, "issue-check", issue.number, item.index, item.title),
        repo,
        frontier_id: frontier.id,
        source_kind: "issue_checklist",
        source_number: Number(issue.number),
        parent_source_number: Number(issue.number),
        title: item.title,
        state: childState,
        origin: "derived",
        confidence: 1,
        position: item.index + 1,
        evidence: {
          issue_url: issue.html_url,
          checklist_index: item.index,
          checked: item.checked,
        },
        updated_at: issue.updated_at ?? repository.updated_at,
      });
    }

    if (issue.state === "open" && checklist.length > 0 && checklist.every(item => item.checked)) {
      attention.push({
        id: id("attn", repo, "issue-complete-open", issue.number),
        repo,
        frontier_id: frontier.id,
        task_id: rootTaskId,
        kind: "issue_complete_open",
        summary: `Issue #${issue.number} has every checklist item complete but remains open.`,
        severity: "medium",
        evidence: { issue_number: issue.number, html_url: issue.html_url },
      });
    }
    if (issue.state === "open" && ageDays(issue.updated_at, now) >= 7) {
      attention.push({
        id: id("attn", repo, "stale-issue", issue.number),
        repo,
        frontier_id: frontier.id,
        task_id: rootTaskId,
        kind: "stale",
        summary: `Issue #${issue.number} has had no activity for ${Math.floor(ageDays(issue.updated_at, now))} days.`,
        severity: "low",
        evidence: { issue_number: issue.number, html_url: issue.html_url },
      });
    }
  }

  for (const pull of pulls) {
    const references = referencedIssueNumbers(pull);
    let frontierId = references.map(number => issueFrontier.get(number)).find(Boolean);
    let frontier;
    if (frontierId) {
      frontier = frontierMap.get(frontierId);
    } else {
      const descriptor = inferFrontier(pull);
      frontier = ensureFrontier(descriptor, { source: "pull_request" });
      frontierId = frontier.id;
    }

    const state = pullState(pull);
    const taskId = id("task", repo, "pr", pull.number);
    tasks.push({
      id: taskId,
      repo,
      frontier_id: frontierId,
      source_kind: "pull_request",
      source_number: Number(pull.number),
      parent_source_number: references[0] ?? null,
      title: pull.title,
      state,
      origin: references.length ? "derived" : "explicit",
      confidence: references.length ? 0.98 : 1,
      position: 1000 + Number(pull.number),
      evidence: {
        html_url: pull.html_url,
        head_sha: pull.head?.sha ?? null,
        base_sha: pull.base?.sha ?? null,
        draft: Boolean(pull.draft),
        check_state: pull._gflow_checks?.state ?? "unknown",
        issue_references: references,
        updated_at: pull.updated_at,
      },
      updated_at: pull.updated_at ?? repository.updated_at,
    });

    if (pull.state === "open" && pull._gflow_checks?.state === "failure") {
      attention.push({
        id: id("attn", repo, "ci-failure", pull.number, pull.head?.sha),
        repo,
        frontier_id: frontierId,
        task_id: taskId,
        kind: "ci_failure",
        summary: `PR #${pull.number} has failing checks on ${String(pull.head?.sha ?? "").slice(0, 8)}.`,
        severity: "high",
        evidence: {
          pull_number: pull.number,
          html_url: pull.html_url,
          head_sha: pull.head?.sha,
          checks: pull._gflow_checks,
        },
      });
    } else if (pull.state === "open" && !pull.draft && pull._gflow_checks?.state === "success") {
      attention.push({
        id: id("attn", repo, "ready-review", pull.number, pull.head?.sha),
        repo,
        frontier_id: frontierId,
        task_id: taskId,
        kind: "ready_review",
        summary: `PR #${pull.number} is open, non-draft, and currently green.`,
        severity: "medium",
        evidence: { pull_number: pull.number, html_url: pull.html_url, head_sha: pull.head?.sha },
      });
    }

    if (pull.state === "open" && ageDays(pull.updated_at, now) >= 7) {
      attention.push({
        id: id("attn", repo, "stale-pr", pull.number),
        repo,
        frontier_id: frontierId,
        task_id: taskId,
        kind: "stale",
        summary: `PR #${pull.number} has had no activity for ${Math.floor(ageDays(pull.updated_at, now))} days.`,
        severity: "low",
        evidence: { pull_number: pull.number, html_url: pull.html_url },
      });
    }
  }

  const frontiers = [...frontierMap.values()];
  for (const frontier of frontiers) {
    const owned = tasks
      .filter(task => task.frontier_id === frontier.id)
      .sort((a, b) => taskPriority(a.state) - taskPriority(b.state) || a.position - b.position || String(a.title).localeCompare(String(b.title)));
    const countable = owned.filter(task => task.state !== "cancelled");
    const done = countable.filter(task => task.state === "done").length;
    frontier.progress = countable.length ? done / countable.length : 0;
    frontier.state = countable.length > 0 && done === countable.length
      ? "completed"
      : owned.some(task => task.state === "blocked") && !owned.some(task => ["active", "review"].includes(task.state))
        ? "blocked"
        : "active";
    frontier.current_task_id = owned.find(task => !["done", "cancelled"].includes(task.state))?.id ?? null;
    frontier.updated_at = owned.reduce(
      (latest, task) => String(task.updated_at ?? "") > String(latest ?? "") ? task.updated_at : latest,
      frontier.updated_at,
    );
  }

  for (const frontier of frontiers) {
    if (frontier.state === "active" && ageDays(frontier.updated_at, now) >= 7) {
      attention.push({
        id: id("attn", repo, "stale-frontier", frontier.id),
        repo,
        frontier_id: frontier.id,
        task_id: frontier.current_task_id,
        kind: "stale_frontier",
        summary: `${frontier.title} has not moved for ${Math.floor(ageDays(frontier.updated_at, now))} days.`,
        severity: "low",
        evidence: { frontier_id: frontier.id },
      });
    }
  }

  const latestCommit = commits[0];
  if (frontiers.length === 0 && (issues.length || pulls.length || commits.length)) {
    const frontier = ensureFrontier({ key: "general", title: "General", reason: "activity-fallback" }, { source: "repository" });
    frontier.updated_at = latestCommit?.commit?.committer?.date ?? repository.updated_at;
  }

  return { frontiers: [...frontierMap.values()], tasks, attention };
}