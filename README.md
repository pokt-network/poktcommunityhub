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
docker compose --profile tools build web migrate
docker compose up -d --no-build --wait
docker compose --profile tools run --rm migrate
```

The app is then at http://127.0.0.1:3000. The app never migrates itself; the
`migrate` service (profile `tools`) applies `packages/store/migrations`.

Sign-in needs every variable in the sign-in block of `.env.example`. Use
`AUTH_URL=http://localhost:3000` and a Discord application whose redirects
include `http://localhost:3000/api/auth/callback/discord`. There is no
"auth off" mode: with a variable missing, `/health/ready` answers 503 and every
signed-in page fails closed.

To fill the local stack with demo quests, ranks and made-up ambassadors (development
only: the script refuses without the `SET` below, and refuses a database that
already has quests):

```bash
{ echo "SET community.seed = 'demo';"; cat tools/seed-demo.sql; } | docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Proof screenshots are written to `PROOFS_DIR` (default `/data/proofs`, the
`proofs` volume in compose). Set it to a local folder when running `pnpm dev`
outside Docker.

### Database tests

The integration and adversarial suites (`*.integration.test.ts`) run against a
migrated Postgres named by `DATABASE_TEST_URL` and skip without it. They empty
that database before every test, so never point it at one you want to keep.

```bash
docker run -d --name community-pgtest -e POSTGRES_USER=community -e POSTGRES_PASSWORD=community -e POSTGRES_DB=community -p 127.0.0.1:55432:5432 postgres:17-alpine
```

Then, with `DATABASE_URL` and `DATABASE_TEST_URL` both set to
`postgres://community:community@127.0.0.1:55432/community`, run `pnpm migrate`
and `pnpm test`.

## Checks

`pnpm check` is the gate CI runs. It does the following, in order:
- builds the packages (`tsc -b`) and typechecks the web app;
- runs lint and format checks;
- confirms the package-boundary rules still fire (`verify:boundaries`);
- checks every migration is numbered and carries both direction markers (`verify:migrations`);
- runs the tool tests and the Vitest suite.

CI also:
- migrates a real Postgres up, all the way down (asserting nothing is left behind) and up again, then runs the database suites with skipping turned into failure;
- builds both images, asserts their labels, brings the stack up, migrates through the image and smoke-tests it;
- scans history and the image for secrets.

## Branches

Work merges to `dev`; `dev` is promoted to `main` with a rebase merge, never a squash, so each commit can be reverted on its own.

## Layout

```
apps/web          Next.js: public pages, ambassador hub, /admin console
apps/migrator     applies the migrations; its own image, run once per deploy
packages/core     pure domain rules: quest liveness, review state machine, ranks
packages/shared   config loading (Zod), logger (pino)
packages/store    migrations, the pg pool, and the transactions over them
tools/            deploy, boundary and migration verification
deploy/           Cherry AS compose override and Caddy site
```

## Deploy

```bash
pnpm deploy:host cherry-as
```

See the runbook. A deploy builds every image, asserts that each image's label names the commit, applies migrations, brings the stack up, checks readiness from inside the stack, installs the Caddy site and prints the rollback command.
