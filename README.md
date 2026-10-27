# POKT Community Hub

Quests, proof review, XP and Discord roles for Pocket Network ambassadors, at
`community.pocket.network`.

## Documents

- [`community-hub-build-brief.md`](community-hub-build-brief.md): the authority. What the hub does, the stack, the phases and every decision.
- [`GATES.md`](GATES.md): phase gates and their reviews.
- [`docs/runbooks/cherry-as.md`](docs/runbooks/cherry-as.md): first-time host setup and deploys.

The community-dev MVP this replaces is preserved at the git tag `mvp-reference`.

## Quick start

Requires Node 24 (pnpm comes from `packageManager` via corepack) and Docker.

```bash
corepack enable
pnpm install
pnpm check
```

To run the stack locally, copy `.env.example` into `.env.db` and `.env.web` (the
example says which variable goes where), then:

```bash
docker compose up -d --build --wait
```

The app is then at http://127.0.0.1:3000.

## Checks

`pnpm check` is the gate CI runs. It does the following, in order:
- builds the packages (`tsc -b`) and typechecks the web app;
- runs lint and format checks;
- confirms the package-boundary rules still fire (`verify:boundaries`);
- runs the tool tests and the Vitest suite.

CI also builds the image, brings the compose stack up and smoke-tests it, and scans history and the image for secrets.

## Branches

Work merges to `dev`; `dev` is promoted to `main` with a rebase merge, never a squash, so each commit can be reverted on its own.

## Layout

```
apps/web          Next.js: public pages, ambassador hub, /admin console
packages/shared   config loading (Zod), logger (pino)
packages/store    Postgres pool; schema and migrations from phase 2
tools/            deploy, boundary verification
deploy/           Cherry AS compose override and Caddy site
```

## Deploy

```bash
pnpm deploy:host cherry-as
```

See the runbook. A deploy builds every image, asserts that each image's label names the commit, brings the stack up, checks readiness from inside the stack, installs the Caddy site and prints the rollback command.
