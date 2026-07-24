# Contract: CI Pipeline

## File

`.github/workflows/ci.yml`

## Triggers

- `pull_request` targeting `main`
- `push` to `main` (post-merge verification)

## Job: `verify` (runs on `ubuntu-latest`)

1. Checkout
2. Set up Node (version matching `.nvmrc`/`package.json` engines if present, else current LTS)
3. `npm ci`
4. `npm run typecheck` — must exit 0
5. `npm test` — must exit 0 (Jest, existing `jest-expo` preset)

## Required-check contract

Both `typecheck` and `test` steps failing (non-zero exit) MUST fail the workflow run. Branch protection on `main` (configured once, outside this workflow file, via repo settings) marks this workflow as a required status check — this repo-settings step is a one-time manual action documented in `quickstart.md`, not something the workflow file itself can enforce.

## Explicitly out of scope

- Deploying the Edge Function or running migrations against staging/production as part of CI — this feature only wires up test/typecheck verification (FR-012); deployment automation is not required by the spec and can be a future slice.
