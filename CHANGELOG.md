# Changelog

## 0.1.2 — 2026-09-30

Private-repository authentication and local-target UX fix. Compiler truth, dependency and eligibility semantics are unchanged.

### Fixed

- automatically reuse an authenticated GitHub CLI session through `gh auth token` when `GITHUB_TOKEN` / `GH_TOKEN` are absent;
- preserve explicit environment-token precedence;
- make private-repository 404s explain the authentication requirement;
- make `scan .` failures outside a Git clone explain the recovery path;
- add an explicit `.npmignore` so Git-based npx installs do not rely on npm's `.gitignore` fallback.


## 0.1.1 — 2026-09-30

Distribution-only follow-up. Compiler truth, dependency and eligibility semantics are unchanged.

### Changed

- npm package identity moved from the unavailable `repo-truth` name to `repo-truth-cli`;
- executable remains `repo-truth`;
- package version advanced to `0.1.1`;
- npm publication workflow supports token bootstrap and future trusted publishing/OIDC;
- npm registry name probes are preserved as launch evidence.


## 0.1.0 — 2026-09-30

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