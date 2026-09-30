# Changelog

## 0.1.0 — unreleased

Initial public extraction of the repository-truth compiler from SNE Labs' internal GitHub-Flow system.

### Added

- deterministic repository truth classification;
- explicit authority ordering and conflict preservation;
- hard dependency extraction from Issues and Pull Requests;
- fail-closed eligibility compilation;
- bounded GitHub observation coverage metadata;
- local clone resolution through `repo-truth scan .`;
- GitHub URL targets;
- `scan`, `next`, `explain` and `--json`;
- optional `.repo-truth.json` canonical authority map;
- deterministic offline demo;
- clean package-install and live GitHub smoke gates;
- self-hosted repository truth for repo-truth itself.

### Guarantees

- GitHub `OPEN` does not imply live roadmap membership.
- Equal-authority contradictions become `UNKNOWN`.
- Ambiguous/missing hard dependencies fence eligibility.
- Bounded scans do not claim repository-total counts.
- No LLM, embeddings or vector database are required by the compiler core.

### Provenance

The initial compiler was extracted from `4LFR3Dv1/GitHub-Flow@be8836984de27132c52936adcb12f7acafe2b3c6`.

See `ORIGIN.md` for the exact donor files.
