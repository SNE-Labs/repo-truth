# repo-truth

[![CI](https://github.com/SNE-Labs/repo-truth/actions/workflows/ci.yml/badge.svg)](https://github.com/SNE-Labs/repo-truth/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/SNE-Labs/repo-truth?display_name=tag)](https://github.com/SNE-Labs/repo-truth/releases)
[![License](https://img.shields.io/github/license/SNE-Labs/repo-truth)](LICENSE)

**Open ≠ actionable.**

Compile GitHub into work a coding agent can actually start.

repo-truth reads issues, pull requests, commits, explicit dependency language, and optional canonical repository documents. It produces three deterministic projections:

```text
GitHub objects
    ↓
repository truth
    ↓
hard dependencies
    ↓
agent eligibility
```

No LLM. No embeddings. No vector database.

If the repository cannot prove that work is live, repo-truth reports `UNKNOWN` instead of guessing.

## One real scan

A maintainer-run scan against a private production repository, with its identity intentionally redacted, produced:

```text
Observed GitHub window
  8 open issues
  9 open pull requests

Open Issue truth
     0  LIVE
     0  BLOCKED
     0  SUPERSEDED
     0  ABSORBED
     0  HISTORICAL
     0  ABANDONED
     8  UNKNOWN

Open Pull Request truth
     0  LIVE
     0  BLOCKED
     0  SUPERSEDED
     9  ABSORBED
     0  HISTORICAL
     0  ABANDONED
     0  UNKNOWN

OPEN ≠ ACTIONABLE
8 observed open issues → 0 verified agent-ready
9 observed open PRs → 9 materially absorbed / 0 unresolved
```

The important part is not the numbers. It is the asymmetry:

- the Pull Requests were still **OPEN** in GitHub, but their heads were already contained in the default branch, so repo-truth could prove they were materially `ABSORBED`;
- the open Issues had no configured canonical authority proving current roadmap membership, so repo-truth left all eight `UNKNOWN`.

The same scan therefore proved stale provider state **and** refused to invent current work.

This is a bounded observation, not a claim about every object in the repository. The public evidence note intentionally withholds the private repository identity: [`docs/evidence/redacted-real-world-scan-2026-09-30.md`](docs/evidence/redacted-real-world-scan-2026-09-30.md).

## Try it

The npm distribution name is `repo-truth-cli`. Until its first npm publication is authorized, run directly from GitHub:

```bash
npx github:SNE-Labs/repo-truth scan owner/repo
```

After npm publication, the equivalent command is:

```bash
npx repo-truth-cli scan owner/repo
```

The installed executable remains `repo-truth`.

Or from inside a local clone whose `origin` points to GitHub:

```bash
npx github:SNE-Labs/repo-truth scan .
```

`.` means **the current Git clone**. Running it from a directory with no GitHub `origin` is intentionally rejected; pass `owner/repo` explicitly instead.

For private repositories, repo-truth resolves authentication in this order:

1. `GITHUB_TOKEN`
2. `GH_TOKEN`
3. the current authenticated GitHub CLI session via `gh auth token`
4. unauthenticated public GitHub access

So a private local clone normally only needs:

```bash
gh auth login
npx github:SNE-Labs/repo-truth scan .
```

The token is used in-memory for GitHub API requests and is not written by repo-truth.

GitHub URLs are accepted too:

```bash
npx github:SNE-Labs/repo-truth scan https://github.com/owner/repo
```

You can still provide a token explicitly:

```bash
GITHUB_TOKEN=... npx github:SNE-Labs/repo-truth scan .
```

If a repository is private and no token/session is available, repo-truth reports an authentication-specific error instead of surfacing GitHub's ambiguous raw 404.

## 10-second demo

The repository ships a deterministic offline fixture:

```bash
npm run demo
```

```text
repo-truth demo

#1  LIVE        READY         Ship the parser
#2  SUPERSEDED  DO NOT START  Use the old cache
#3  LIVE        FENCED        Publish the release
#4  LIVE        READY         Finish release notes

verified ready: #1, #4
```

No network, token or model is involved in this demo. The fixture is covered by the normal test suite. A reusable terminal capture lives in [`docs/demo.txt`](docs/demo.txt).

Example output:

```text
repo-truth · owner/repo

Observed GitHub window
  50 issue roots observed · truncated
  47 open issues in observed window
  25 pull requests observed · truncated
  11 open pull requests in observed window

Open Issue truth
     8  LIVE
     4  BLOCKED
     2  SUPERSEDED
     1  ABSORBED
     0  HISTORICAL
     0  ABANDONED
    32  UNKNOWN

Open Pull Request truth
     0  LIVE
     0  BLOCKED
     0  SUPERSEDED
     8  ABSORBED
     0  HISTORICAL
     0  ABANDONED
     3  UNKNOWN

Agent eligibility
  8 verified agent-ready issues
  4 admitted tasks fenced
  32 open issues truth unresolved

OPEN ≠ ACTIONABLE
47 observed open issues → 8 verified agent-ready
11 observed open PRs → 8 materially absorbed / 3 unresolved
```

> The numbers above illustrate the output format; they are not a benchmark claim.

## Commands

```bash
repo-truth scan owner/repo
repo-truth scan .
repo-truth scan https://github.com/owner/repo
repo-truth next .
repo-truth explain owner/repo#42
repo-truth explain .#42
repo-truth scan owner/repo --json
```

`scan` compiles the repository. `next` emits only verified agent-ready issues. `explain` shows why one issue was classified and whether dependencies fence it.

## Zero-config behavior

The CLI reports **open Issue truth** and **open Pull Request truth** separately inside the observed window. This matters because an administratively open PR can already be materially contained in the default branch. The full JSON also exposes `all_task_truth` across Issues, Pull Requests and derived checklist tasks.

`--limit` bounds observation; it is never presented as the repository's total backlog. The report exposes `source.coverage` with the requested limit, observed counts and explicit `*_truncated` flags.

repo-truth can immediately prove relationships that are explicit in GitHub material, including:

- `blocked by #N`
- `depends on #N`
- `requires #N`
- unresolved issue checklist requirements
- merged pull-request relationships
- dependency cycles
- ambiguous Issue/PR number references

An open GitHub object alone is **not** treated as proof that the work still belongs to the live roadmap.

Truth extraction also strips fenced code blocks, inline code spans, blockquotes and HTML comments before interpreting text-derived authority. Examples in contracts and quoted discussion cannot silently become repository truth.

## Tell repo-truth where roadmap truth lives

Add `.repo-truth.json`: