# repo-truth v0.1.0

**Open ≠ actionable.**

repo-truth is a deterministic compiler between GitHub and coding agents.

It reads repository evidence and compiles:

```text
repository truth
      ↓
dependencies
      ↓
agent eligibility
```

The core rule is intentionally conservative: an open GitHub Issue is not automatically considered live work.

## Install / run

Until npm publication is complete:

```bash
npx github:SNE-Labs/repo-truth scan owner/repo
```

From a local clone:

```bash
npx github:SNE-Labs/repo-truth scan .
```

## Why

Coding agents can see Issues, Pull Requests and repository files, but those objects can disagree.

An Issue may still be open after its implementation was absorbed, superseded, abandoned or moved elsewhere. repo-truth preserves that uncertainty instead of guessing.

## v0.1 surface

```bash
repo-truth scan .
repo-truth next .
repo-truth explain .#42
repo-truth scan . --json
```

Optional repository authority:

```json
{
  "authority": ["ROADMAP.md", "docs/status.md"]
}
```

## Validation

Launch candidate gates:

- 50/50 deterministic tests pass;
- package tarball installs in a clean project;
- installed binary runs `scan .` against a real GitHub clone;
- live GitHub reader smoke passes;
- repository self-hosts its own truth;
- bounded observation exposes explicit truncation metadata.

## Non-goals

v0.1 is not:

- an LLM issue summarizer;
- a project-management dashboard;
- a coding agent runtime;
- a GitHub write bot;
- a universal semantic oracle.

## GitHub metadata for launch

Recommended repository description:

> Open ≠ actionable. A deterministic compiler between GitHub and coding agents — no LLM, no embeddings.

Recommended topics:

```text
github
coding-agents
developer-tools
cli
automation
issues
pull-requests
agentic-ai
```

## Release title

`repo-truth v0.1.0 — Open ≠ actionable`

## Release commit candidate

Current candidate at preparation time:

`b6398930f9d244fc8cdf1ca7ca05b2b5d98d69cf`

If additional pre-release documentation-only commits land, tag the final validated `main` commit instead.
