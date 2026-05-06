# AGENTS.md

Instructions for contributors and coding agents working in `smartfarm-web`.

## Workflow Mode

This repository uses a **branch + pull request** workflow.

- Do not push feature work directly to `main`.
- Create a branch per issue or scoped change.
- Push the branch to GitHub.
- Open a pull request before merge.

## Branch Naming

- `feat/ome-<number>-<slug>`
- `fix/ome-<number>-<slug>`
- `docs/ome-<number>-<slug>`
- `chore/ome-<number>-<slug>`

Example:

- `feat/ome-18-review-queue-ui`

## Pull Request Rules

- Title format: `[OME-18] Build review queue UI shell`
- Keep UI work aligned to the current GAP-first phase.
- Reference the related Paperclip issue in the PR body.

## Product Focus

Build for:

- farmers
- experts
- compliance leads

Current UX priorities:

1. evidence submission
2. review clarity
3. audit-readiness visibility

