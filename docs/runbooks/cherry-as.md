# Cherry AS: hosting the Community Hub

Host: `agentic-services` (84.32.25.28), reached as `ssh cherry-as` (user `deploy`, key `~/.ssh/id_cherry`). Ubuntu 24.04 with Docker and Compose.

The host is shared with the mainnet and beta supplier stacks, so read the "Do not touch" section before changing anything.

## What the hub owns on the host

| Path | What |
|---|---|
| `/opt/pocket/services/community/` | The deployed tree (`git archive` of the commit), compose project `pocket-community` |
| `/opt/pocket/services/community/.env.db`, `.env.web` | Secrets, mode 600, written once by hand (below) |
| `/opt/pocket/services/community/DEPLOYED_COMMIT` (and `.prev`) | What is running, and the rollback target |
| `/opt/pocket/caddy/sites/community.caddy` | The hub's one file in the shared Caddy. Installed by the deploy; validated before every reload. |
| Docker volume `pocket-community_pgdata` | The database |

## Do not touch

- **The shared Caddy** (`/opt/pocket/caddy/Caddyfile`, its compose file, and the other files in `sites/`) belongs to the Pocket Service Manager. The hub adds `community.caddy` and nothing else.
  - The Service Manager only removes a site file that claims the same hostname as one of its stacks.
- **The supplier stacks** (`/opt/pocket/supplier-*`) and the other service backends.

## Networks

`web` joins `pocket-supplier`, the network the shared Caddy is on, under the alias `community-web`. Every other service backend on this host joins it the same way.

`postgres` is on an internal network with no route out, so it cannot reach the internet. No container of ours publishes a port on the host; the deploy refuses if one does.

## First-time setup (once)

1. **DNS.** Jinx adds an A record at GoDaddy: `community` → `84.32.25.28`. It must not be proxied, so Caddy's HTTP challenge reaches this host.
2. **Directory and secrets**, on the host as `deploy`:

   ```bash
   mkdir -p /opt/pocket/services/community && cd /opt/pocket/services/community
   umask 077
   pw="$(openssl rand -hex 24)"
   printf 'POSTGRES_USER=community\nPOSTGRES_DB=community\nPOSTGRES_PASSWORD=%s\n' "$pw" > .env.db
   printf 'DATABASE_URL=postgres://community:%s@postgres:5432/community\nLOG_LEVEL=info\n' "$pw" > .env.web
   unset pw
   ```

   Phase 3 adds sign-in. Append its variables to `.env.web` (names in `.env.example`; values from the Discord application, copied into 1Password):

   ```bash
   umask 077
   printf 'AUTH_URL=https://community.pocket.network\n' >> .env.web
   printf 'AUTH_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.web
   # then add by hand, with the real values:
   #   AUTH_DISCORD_ID=  AUTH_DISCORD_SECRET=  DISCORD_GUILD_ID=  ADMIN_BOOTSTRAP_DISCORD_IDS=
   ```

   Without them `/health/ready` answers 503 with `"config": false`, and every signed-in page fails closed.

   The copy of record goes in 1Password (item to be named when created). The host files are a deployment of that record, not the original.
3. **Deploy:** `pnpm deploy:host cherry-as` from a clean checkout of the commit to ship.

## Deploying

`pnpm deploy:host cherry-as` runs these steps:
- **Preconditions:** a clean tree, a non-root ssh user, the secret files present at mode 600, and enough free disk.
- **Ship:** sends the tracked tree and sweeps files that are no longer tracked.
- **Port check:** refuses any port published on a public interface.
- **Build:** builds every image (web and the migrator), asserts each image's revision label and tags it by commit.
- **Migrate:** runs the migrator image just built. It refuses if the database has applied a migration the image does not carry, and checks afterwards that every migration it carries is applied.
- **Start:** runs `up --wait`.
- **Readiness:** checks it from inside the stack.
- **Caddy:** installs the site file, validates the whole Caddy config (restoring the previous file if it fails), then reloads.
- **Public check:** probes the public URL.

## Rollback

The deploy prints the exact command. It retags the previous commit's images as `latest`, runs `up -d --no-build`, and restores `DEPLOYED_COMMIT`. It does not undo migrations.

## Backups

Not yet: phase 7. The destination is still open (build brief section 9, item 8).
