/**
 * Backfill discordId from account.accountId and apply ADMIN_DISCORD_IDS roles.
 * Usage: node scripts/backfill-discord-admin.mjs
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });

const adminIds = new Set(
  (process.env.ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.role, u."discordId", a."accountId"
     FROM public."user" u
     LEFT JOIN public.account a
       ON a."userId" = u.id AND a."providerId" = 'discord'`,
  );

  for (const row of rows) {
    const discordId = row.discordId ?? row.accountId;
    if (!discordId) {
      console.log(`skip ${row.name}: no discord account`);
      continue;
    }
    const role = adminIds.has(discordId) ? "admin" : "ambassador";
    await pool.query(
      `UPDATE public."user"
       SET "discordId" = $1, role = $2, "updatedAt" = now()
       WHERE id = $3`,
      [discordId, role, row.id],
    );
    console.log(
      `updated ${row.name}: discordId=${discordId} role=${role}${
        adminIds.has(discordId) ? " (in ADMIN_DISCORD_IDS)" : ""
      }`,
    );
  }

  if (adminIds.size === 0) {
    console.log(
      "\nADMIN_DISCORD_IDS is empty. Add your Discord ID to .env, then re-run this script.",
    );
    console.log(
      "Your Discord ID is the accountId printed above (or from Discord → Copy User ID).",
    );
  }
} finally {
  await pool.end();
}
