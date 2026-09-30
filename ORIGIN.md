# Origin

repo-truth was extracted from an internal SNE Labs operational system rather than designed as a greenfield demo.

The initial deterministic compiler was taken from:

- donor repository: `4LFR3Dv1/GitHub-Flow`
- donor commit: `be8836984de27132c52936adcb12f7acafe2b3c6`
- extraction date: 2026-09-30

Initial donor files:

- `src/authority-text.mjs`
- `src/projector.mjs`
- `src/dependencies.mjs`
- `src/eligibility.mjs`
- `src/repository-truth.mjs`
- `src/truth-evidence.mjs`

The donor code was reorganized under `src/core/` without changing its core truth/dependency/eligibility semantics. repo-truth adds a stateless GitHub reader, public configuration contract, CLI, packaging, and OSS-facing documentation.

The released repository is governed by its own history from this point forward.
