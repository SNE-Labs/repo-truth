# Redacted real-world scan evidence

Observed: 2026-09-30
Source: maintainer-run scan from a private GitHub repository
Repository identity: intentionally withheld

Command shape:

```powershell
npx --yes "github:SNE-Labs/repo-truth#v0.1.4" scan .
```

Observed result:

```text
Observed GitHub window
  14 issue roots observed
  8 open issues in observed window
  11 pull requests observed
  9 open pull requests in observed window

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

Authority
  no .repo-truth.json configured
  provider OPEN cannot promote work to LIVE

Agent eligibility
  0 verified agent-ready issues
  0 admitted tasks fenced
  8 open issues truth unresolved

OPEN ≠ ACTIONABLE
8 observed open issues → 0 verified agent-ready
9 observed open PRs → 9 materially absorbed / 0 unresolved
```

Interpretation:

- the observed Pull Requests were still OPEN according to GitHub provider state;
- their heads were already reachable from the observed default-branch material, so repo-truth classified them as ABSORBED;
- the open Issues had no configured canonical authority proving live roadmap membership, so repo-truth preserved UNKNOWN;
- no Issue was promoted to READY from provider-open state alone.

This artifact is deliberately redacted because the source repository is private. It is evidence of the output shape and semantics, not a publicly reproducible benchmark.
