import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const before = await client.query(
    `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()`,
  );
  console.log("connections_before", before.rows[0].n);

  const r = await client.query(`
    SELECT pg_terminate_backend(pid) AS killed
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
      AND datname = current_database()
      AND usename = current_user
  `);
  console.log("terminated", r.rowCount);
} catch (err) {
  console.error("Failed to clear sessions:", err.message);
  console.error(
    "If this fails through the pooler, restart the Supabase project from the dashboard.",
  );
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
