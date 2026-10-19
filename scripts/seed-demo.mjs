import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

config({ path: ".env" });

const sqlPath = resolve("supabase/seed/demo_data.sql");
const sql = readFileSync(sqlPath, "utf8");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

try {
  await pool.query(sql);
  const quests = await pool.query(
    `SELECT id, title, xp_reward, status FROM public.quests ORDER BY "createdAt" DESC`,
  );
  const subs = await pool.query(
    `SELECT status, COUNT(*)::int AS n FROM public.submissions GROUP BY status ORDER BY status`,
  );
  console.log("Seeded", sqlPath);
  console.log("Quests:", quests.rows);
  console.log("Submissions by status:", subs.rows);
} finally {
  await pool.end();
}
