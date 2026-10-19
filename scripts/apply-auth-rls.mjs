import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

config({ path: ".env" });

const sqlPath = resolve("supabase/migrations/003_auth_rls.sql");
const sql = readFileSync(sqlPath, "utf8");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  await pool.query(sql);
  console.log("Applied", sqlPath);
} finally {
  await pool.end();
}
