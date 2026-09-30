# repo-truth v0.1.4

Open Pull Request truth is now visible in the default CLI output.

## Why

The first real GitHub-Flow scan exposed the strongest demonstration of repo-truth's thesis:

Several Pull Requests are still reported as OPEN by GitHub even though their head commits are already contained in the repository default branch.

That is different from an unresolved Issue:

```text
GitHub PR state: OPEN
default branch: contains PR head
repo-truth: ABSORBED
```

## Added

- separate `open_pull_truth` summary in JSON;
- separate **Open Pull Request truth** section in the CLI;
- explicit headline:

```text
N observed open PRs → X materially absorbed / Y unresolved
```

## Semantics

No new truth rule was added.

The classifier already emitted `default_branch_material → absorbed` when an open Pull Request head was reachable from the observed default-branch commit window.

v0.1.4 only makes that existing result visible instead of hiding it inside `all_task_truth`.

Open Issues remain independent. An Issue is not automatically absorbed merely because a related PR is materially present unless repository evidence proves that relation.
