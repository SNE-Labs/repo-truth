# repo-truth v0.1.2

Private-repository authentication and local-target UX fix.

## Fixed

A real Windows smoke uncovered two distinct first-run failure modes:

1. `repo-truth scan .` outside a Git clone returned only `git_origin_unavailable`;
2. inside a private GitHub repository, repo-truth resolved the local `origin` but called the GitHub API unauthenticated, which surfaced GitHub's ambiguous 404.

v0.1.2 fixes both without changing repository-truth semantics.

## Authentication order

repo-truth now resolves GitHub authentication in this order:

1. `GITHUB_TOKEN`
2. `GH_TOKEN`
3. authenticated GitHub CLI session via `gh auth token`
4. unauthenticated public access

This means a developer already authenticated with GitHub CLI can scan a private local clone directly:

```bash
gh auth login
npx github:SNE-Labs/repo-truth scan .
```

repo-truth does not write the discovered token to disk.

## Local target behavior

`.` means the current Git clone. Outside a repository with a GitHub `origin`, the CLI now explains that the user should either enter a GitHub clone or pass `owner/repo` explicitly.

## Packaging

An explicit `.npmignore` now defines the package surface, removing npm's `gitignore-fallback` warning for Git-based installs.

## Validation

- environment-token precedence covered;
- `gh auth token` fallback covered;
- missing/unauthenticated `gh` covered;
- private-repository unauthenticated 404 covered;
- Authorization header injection covered without exposing the token;
- local target recovery path covered;
- existing truth/dependency/eligibility suite preserved.
