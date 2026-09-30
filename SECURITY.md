# Security Policy

repo-truth is read-only by design in v0.1. It reads public GitHub data or data authorized by the user's GitHub token and compiles deterministic local output.

## Supported versions

Security fixes are applied to the latest released version and `main`.

## Reporting a vulnerability

Do not include tokens, private repository contents, credentials or other sensitive evidence in a public issue.

If GitHub private vulnerability reporting is available for this repository, use it. Otherwise, open a minimal public issue stating that you found a security problem and need a private contact path, without including sensitive details.

## Security-sensitive areas

Reports are especially useful for:

- token exposure in logs or errors;
- path traversal through authority-document configuration;
- repository-target parsing that escapes the intended GitHub repository;
- unbounded API reads or denial-of-service behavior;
- malicious repository content being promoted into authority unexpectedly;
- output that claims evidence or eligibility not supported by the observed inputs.

## Design boundary

repo-truth does not execute repository code, write to scanned repositories, merge pull requests, close issues or grant coding-agent authority.

A future feature that introduces mutation or code execution must be treated as a new security boundary rather than an incremental extension of the current read-only model.
