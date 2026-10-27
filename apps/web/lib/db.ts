import 'server-only';

import { createPool, type Pool } from '@community/store';

import { webConfig } from './config';

// One pool per server process. Kept on globalThis so `next dev` hot reloads reuse
// it instead of opening a new pool on every edit.
const holder = globalThis as unknown as { communityPool?: Pool };

export function db(): Pool {
  holder.communityPool ??= createPool({
    connectionString: webConfig().DATABASE_URL,
    application_name: 'community-web',
  });
  return holder.communityPool;
}
