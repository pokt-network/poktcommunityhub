import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

config({ path: ".env" });

const sqlPath = resolve("supabase/migrations/004_server_roles.sql");
const sql = readFileSync(sqlPath, "utf8");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  await pool.query(sql);
  const roles = await pool.query(`SELECT id, name, xp_required, color FROM public.server_roles ORDER BY position ASC`);
  const userRoles = await pool.query(`SELECT COUNT(*)::int AS count FROM public.user_roles`);
  console.log("Successfully applied", sqlPath);
  console.log("Configured server roles:", roles.rows);
  console.log("Total user role assignments backfilled:", userRoles.rows[0]?.count);
} finally {
  await pool.end();
}
