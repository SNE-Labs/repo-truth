# repo-truth v0.1.1

Distribution follow-up for npm package identity. The repository product remains **repo-truth** and the CLI remains **repo-truth**.

## What changed

The unscoped npm name `repo-truth` is already owned by an unrelated package. Launch-time registry probes showed:

```text
repo-truth        EXISTS (unrelated package)
repo-truth-cli    E404 / not found
```

v0.1.1 therefore changes only package distribution metadata:

- npm package: `repo-truth-cli`
- CLI executable: `repo-truth`
- repository: `SNE-Labs/repo-truth`

No truth, dependency or eligibility semantics changed.

## Run now

GitHub distribution remains immediately available:

```bash
npx github:SNE-Labs/repo-truth scan .
```

After the first npm publication is authorized:

```bash
npx repo-truth-cli scan .
```

A global installation will expose the same command:

```bash
npm install -g repo-truth-cli
repo-truth scan .
```

## npm publishing boundary

The repository includes `.github/workflows/publish-npm.yml`.

For the first npm publication, a maintainer must provide real npm authority (for example an `NPM_TOKEN` repository secret). After the package exists, npm trusted publishing can be configured for the workflow so later releases can use GitHub OIDC instead of a long-lived token.

The workflow intentionally does not fabricate or embed npm credentials.

## Evidence

Package-name probe captured on 2026-09-30:

`docs/evidence/npm-package-names-2026-09-30.txt`
