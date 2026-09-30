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

GitHub URLs are accepted too:

```bash
npx github:SNE-Labs/repo-truth scan https://github.com/owner/repo
```

For higher GitHub API limits or private repositories:

```bash
GITHUB_TOKEN=... npx github:SNE-Labs/repo-truth scan .
```

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

Repository truth
     8  LIVE
     4  BLOCKED
     2  SUPERSEDED
     1  ABSORBED
     0  HISTORICAL
     0  ABANDONED
    32  UNKNOWN

Agent eligibility
  8 verified agent-ready issues
  4 admitted tasks fenced
  32 open issues truth unresolved

OPEN ≠ ACTIONABLE
47 observed open issues → 8 verified agent-ready
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

The summary truth counts are scoped to **open Issue roots inside the observed window**. The full JSON also exposes `all_task_truth` across Issues, Pull Requests and derived checklist tasks.

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

## Tell repo-truth where roadmap truth lives

Add `.repo-truth.json`:

```json
{
  "authority": ["README.md", "ROADMAP.md", "docs/status.md"]
}
```

These files may contain explicit declarations such as:

```text
Current implementation: PR #51
Issue #42 is superseded
Issue #18 is historical
```

Canonical repository evidence outranks lower-authority relationship evidence. Equal-authority contradictions collapse to `UNKNOWN`; repo-truth does not pick a convenient winner.

## Why coding agents need this

GitHub stores objects. It does not guarantee that every open object still represents current work.

```text
Issue #42: OPEN

ROADMAP.md:
  Issue #42 is superseded

PR #51:
  MERGED

repo-truth:
  SUPERSEDED
  DO NOT START
```

That distinction matters when an autonomous coding agent is selecting work.

## Compiler model

```text
Issues / PRs / commits / docs
             │
             ▼
       truth evidence
             │
             ▼
      repository truth
             │
       admitted only
             │
       ┌─────┴─────┐
       ▼           ▼
 dependencies    tasks
       └─────┬─────┘
             ▼
        eligibility
       ┌─────┴─────┐
       ▼           ▼
     READY       FENCED
```

The core is deterministic and side-effect free. The GitHub reader is a separate stateless boundary.

## Development

Requires Node.js 22+.

```bash
npm run ci
node bin/repo-truth.mjs scan SNE-Labs/repo-truth
```

## Origin

The compiler was extracted from SNE Labs' internal GitHub-Flow system. See [`ORIGIN.md`](ORIGIN.md) for the exact donor commit and files. The launch is being measured explicitly; see [`docs/experiment.md`](docs/experiment.md).

## Contributing

Contributions are welcome when they preserve the fail-closed contract. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before changing truth, dependency or eligibility semantics.

Security-sensitive findings should follow [`SECURITY.md`](SECURITY.md) and must not include credentials or private repository content in public issues.

See [`CHANGELOG.md`](CHANGELOG.md) for release history. npm package-name evidence is frozen at [`docs/evidence/npm-package-names-2026-09-30.txt`](docs/evidence/npm-package-names-2026-09-30.txt).

## Status

v0.1 is intentionally conservative. It is a compiler of evidence, not a universal semantic oracle. Expect `UNKNOWN` when a repository does not declare enough truth to automate safely.

MIT licensed.