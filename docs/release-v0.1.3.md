# repo-truth v0.1.3

Authority-input hygiene and scan explanation fix.

## Why

The first real scan against GitHub-Flow correctly returned all open Issues as UNKNOWN because the repository had no configured canonical authority for those objects.

While reviewing the repository's own documentation authority map, we found a correctness hazard: canonical contract documents contain example phrases such as `PR #16 supersedes PR #4`. Text examples must never become repository truth.

## Fixed

Text-derived truth extraction now removes before interpretation:

- fenced code blocks;
- inline code spans;
- blockquotes;
- HTML comments.

Merged-PR closure syntax such as `Closes #N` is sanitized through the same authority boundary, so examples cannot absorb real Issues.

The CLI now also explains whether canonical authority is configured:

```text
Authority
  no .repo-truth.json configured
  provider OPEN cannot promote work to LIVE
```

## Invariants

Unchanged:

- GitHub OPEN alone never promotes LIVE;
- explicit real evidence outside examples still compiles normally;
- equal-authority contradictions remain UNKNOWN;
- ambiguous/missing dependencies remain fenced;
- the compiler remains deterministic and LLM-free.
