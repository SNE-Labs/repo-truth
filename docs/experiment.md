# Organic distribution experiment

repo-truth is the first SNE Labs repository being treated as a measured OSS distribution experiment rather than only a code release.

## Pre-launch baseline

Observed before any coordinated external distribution:

| Field | Value |
| --- | --- |
| Repository created | 2026-09-30T15:33:16Z |
| Baseline observed | 2026-09-30T15:54Z |
| Stars | 0 |
| Forks | 0 |
| Subscribers | 0 |
| Public repository | yes |
| Distribution T0 | pending |

The repository being public is not itself defined as distribution T0. T0 will be the first deliberate external launch to a relevant developer community.

## Measurement windows

At T0 record the exact repository state and then measure:

```text
1h
6h
12h
24h
48h
72h
7d
```

For each window record stars, forks, external mentions and any observed GitHub Trending appearance.

## Integrity rules

- no purchased stars;
- no automated or bot stars;
- no reciprocal-star campaigns;
- no fabricated benchmarks;
- no changing compiler semantics to make a chosen public repository produce a better launch screenshot;
- public scans used as evidence preserve their exact command, date and bounded limit.

## Hypothesis

A small OSS artifact can generate its own distribution when it combines a compressible claim, concrete proof and a result developers can reproduce on repositories they already care about.

The launch claim under test is:

> **Open ≠ actionable.**
>
> repo-truth compiles GitHub into work a coding agent can actually start.

## First external scan

One bounded scan was run before launch against a public repository not controlled by SNE Labs:

- repository: `openai/codex`
- observed at: 2026-09-30T15:58:27Z
- command: `node bin/repo-truth.mjs scan openai/codex --limit 25`
- result inside the bounded observed window: 20 open Issues, 20 `UNKNOWN`, 0 verified agent-ready
- compiler semantics changed after seeing result: no

The raw terminal output is frozen at [`docs/evidence/openai-codex-2026-09-30.txt`](evidence/openai-codex-2026-09-30.txt).

This result is useful because it demonstrates the zero-config fail-closed boundary: GitHub `OPEN` state alone was not promoted into roadmap truth.

### Coverage correction before T0

The first external scan used `--limit 25`. Its raw output is preserved unchanged as evidence, but the pre-launch review found that the original CLI wording could be read as a repository-total count.

Before distribution T0, repo-truth was changed so bounded scans explicitly report:

- requested observation limit;
- Issue roots observed;
- Pull Requests observed;
- whether each window was truncated.

The historical `20 open issues` line in the frozen artifact therefore means **20 open Issues inside the observed bounded window**, not a claim about the total open-issue count of `openai/codex`.

This correction changes presentation/coverage accounting, not truth, dependency or eligibility semantics.
