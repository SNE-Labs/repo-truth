# T0 launch protocol

This document defines how repo-truth moves from a public repository to a measured distribution experiment.

It does **not** define product semantics. Issue #3 remains the canonical launch ledger.

## Objective

Test whether a small, useful OSS primitive can generate third-party distribution from a zero-audience GitHub baseline.

The object under test is:

> **Open ≠ actionable.**

repo-truth deterministically compiles repository evidence into truth, dependencies and agent eligibility.

## What is not T0

None of these events count as distribution T0:

- repository creation;
- making the repository public;
- merging implementation PRs;
- publishing GitHub releases;
- CI runs;
- package-name probes;
- direct visits by maintainers.

Those events establish the artifact. They do not deliberately inject it into an external audience.

## Remaining pre-T0 gate

GitHub repository metadata must be set before the first deliberate external submission.

Description:

```text
Open ≠ actionable. A deterministic compiler between GitHub and coding agents — no LLM, no embeddings.
```

Topics:

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

npm publication is **not** a T0 blocker. The project is already runnable without signup or package-registry authority:

```bash
npx github:SNE-Labs/repo-truth scan owner/repo
```

The npm package `repo-truth-cli` is a later distribution surface.

## T0 definition

If Hacker News is the first deliberate external channel, T0 is the timestamp at which the human-authored Show HN submission becomes visible on Hacker News.

Record immediately:

- exact UTC timestamp;
- `main` SHA;
- latest release tag;
- stars;
- forks;
- subscribers;
- open Issues;
- exact submission URL;
- exact channel;
- repository description/topics.

Do not retroactively move T0 to a later moment of traction.

## First channel: Show HN

repo-truth fits the current Show HN eligibility shape because it is a non-trivial project people can run immediately without signup.

Current Hacker News rules matter:

- the submission must point to something users can actually try;
- do not solicit upvotes or booster comments;
- do not use HN primarily as a promotion mechanism;
- avoid marketing/sales language;
- **HN currently prohibits generated or AI-edited text in submissions and comments.**

Therefore the Show HN title, submission text and every maintainer comment must be written by the human maintainer without AI-generated or AI-edited wording.

This repository intentionally does not contain launch copy for Hacker News.

Official references:

- https://news.ycombinator.com/showhn.html
- https://news.ycombinator.com/newsguidelines.html
- https://news.ycombinator.com/item?id=22336638

## Facts the human submission can draw from

These are source facts, not suggested wording.

### Problem

- GitHub exposes object state such as OPEN/CLOSED.
- OPEN does not prove that an Issue still belongs to current work.
- coding agents selecting work from provider state alone can therefore start stale or causally blocked tasks.

### What repo-truth does

- reads GitHub Issues, Pull Requests, commits and optional canonical repository documents;
- extracts explicit evidence;
- classifies repository truth;
- compiles hard dependencies;
- emits agent eligibility;
- preserves UNKNOWN when evidence is insufficient.

### Fail-closed properties

- provider OPEN state alone never asserts live roadmap membership;
- equal-authority contradictions collapse to UNKNOWN;
- ambiguous/missing hard dependency references fence eligibility;
- rejected dependency cycles remain causal fences;
- bounded observation is reported as bounded observation, not repository-total truth.

### Implementation

- deterministic JavaScript / Node.js 22+;
- no runtime npm dependencies in the initial core;
- no LLM;
- no embeddings;
- no vector database;
- read-only GitHub boundary in v0.1;
- 50 deterministic tests at launch candidate;
- clean package installation and installed-binary `scan .` smoke validated in GitHub Actions.

### Try path

```bash
npx github:SNE-Labs/repo-truth scan owner/repo
```

From a local GitHub clone:

```bash
npx github:SNE-Labs/repo-truth scan .
```

Offline deterministic demo:

```bash
git clone https://github.com/SNE-Labs/repo-truth
cd repo-truth
npm run demo
```

### Known limitation worth stating plainly

Zero-config mode is conservative.

The first frozen external scan against a bounded window of `openai/codex` produced:

- 20 observed open Issue roots;
- 20 UNKNOWN;
- 0 verified agent-ready.

That is not a claim about the total Codex backlog. It demonstrates that GitHub OPEN state alone was insufficient evidence for repo-truth to promote those Issues into current work.

A repository can declare canonical roadmap authority through `.repo-truth.json`.

## First 90 minutes

Do not deliberately post the repository into a second external community during the first 90 minutes.

Record:

- stars at T0;
- stars at T0 + 30m;
- stars at T0 + 60m;
- stars at T0 + 90m;
- forks;
- first external commenter/user;
- first third-party repost or link;
- HN points/comments if HN is T0.

The purpose is attribution: determine whether the first seed can create redistribution on its own.

Do not ask friends, users or collaborators to vote, star, comment or repost.

## Second intervention

After the first 90-minute observation window, choose at most one additional channel.

The second intervention should be logged separately as T1 with:

- timestamp;
- channel;
- exact URL;
- stars/forks immediately before;
- stars/forks after 30/60/90 minutes.

Do not call T1 organic redistribution. It is a new deliberate intervention.

## Organic redistribution event

Record the first third-party link/post that was not requested by the maintainer as `R1`.

Capture:

- timestamp;
- source;
- URL;
- audience/community if visible;
- stars immediately before;
- stars 30/60 minutes later.

R1 is more important to this experiment than raw impressions because it is evidence that the repository began distributing itself.

## GitHub Trending observation

If repo-truth appears on GitHub Trending, record:

- exact first observed timestamp;
- global vs language page;
- daily vs weekly surface if visible;
- rank;
- stars at observation;
- star velocity over the preceding 1h / 6h / 24h;
- whether the observation happened before or after R1.

Do not infer the GitHub Trending algorithm from one event.

## Measurement schedule

Primary checkpoints:

```text
T0
+30m
+60m
+90m
+6h
+12h
+24h
+48h
+72h
+7d
```

At each checkpoint record at least:

- stars;
- forks;
- subscribers/watchers if available;
- external mentions discovered;
- deliberate interventions since previous checkpoint;
- observed Trending state.

## Success is not defined only as Trending

The experiment distinguishes four outcomes:

1. **No conversion** — relevant people arrive but do not star/fork/use.
2. **Conversion without redistribution** — stars occur, but distribution remains maintainer-driven.
3. **Third-party redistribution** — unrequested people begin sharing the repository.
4. **GitHub amplification** — GitHub Trending or another internal discovery surface visibly amplifies the curve.

This lets a failed Trending attempt still produce useful evidence about packaging and distribution.

## Integrity rules

- no purchased stars;
- no bot stars;
- no reciprocal-star campaigns;
- no voting requests;
- no coordinated booster comments;
- no rewriting historical evidence after seeing the result;
- no changing compiler semantics to manufacture a better public screenshot;
- every deliberate distribution action gets its own timestamp.

## Current pre-T0 state

At the time this protocol was written:

- GitHub release: `v0.1.1`;
- release commit: `6a10bfc339c56cc9db31f8720a8d21ebeff083f4`;
- npm distribution identity: `repo-truth-cli` (not yet first-published);
- repository is runnable through GitHub;
- pre-launch baseline remained 0 stars / 0 forks / 0 subscribers;
- distribution T0 had not started.
