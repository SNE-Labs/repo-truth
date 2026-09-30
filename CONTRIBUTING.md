# Contributing to repo-truth

repo-truth is intentionally small and conservative. Contributions are welcome when they make repository truth more useful **without turning uncertainty into guesses**.

## Development

Requirements:

- Node.js 22+
- Git

Run the complete local gate:

```bash
npm run ci
npm run demo
```

There are no runtime npm dependencies in v0.1.

## Core invariants

Changes to truth, dependency or eligibility semantics should preserve these rules:

1. GitHub `OPEN` state alone does not prove that work is current.
2. Equal-authority contradictions collapse to `UNKNOWN`.
3. Missing or ambiguous hard dependencies fail closed.
4. Rejected dependency cycles remain causal fences.
5. Presentation code must distinguish bounded observation from repository totals.
6. The deterministic core does not require an LLM, embeddings or a vector database.
7. Provider prose or fenced examples must not silently become authority.

If a contribution intentionally changes one of these invariants, the PR must explain why, include a concrete counterexample to the old behavior, and update the public contract.

## Good contribution shapes

Useful changes usually fit one of these categories:

- deterministic evidence extraction;
- additional explicit dependency syntax;
- GitHub adapter correctness;
- clearer coverage/provenance;
- new output formats that preserve the same semantics;
- fixtures for real failure modes;
- documentation and integration examples;
- performance improvements with identical output.

## Tests

Prefer the smallest deterministic fixture that proves the behavior.

A semantic bug fix should normally include both:

- the case that previously failed; and
- a nearby case that must remain unchanged.

Do not use mocked "green path only" tests to replace an existing truth invariant.

## Pull requests

Keep PRs narrow. In the description, include:

- the repository behavior being changed;
- evidence or fixture that motivated the change;
- whether truth/dependency/eligibility semantics changed;
- the exact validation command you ran.

Before opening a PR:

```bash
npm run ci
```

## Scope discipline

repo-truth is not trying to become:

- a project-management dashboard;
- a general code graph;
- an issue summarizer;
- an LLM repository agent;
- a GitHub write automation system.

The public primitive is the compiler boundary between repository evidence and work an agent may safely consider actionable.
