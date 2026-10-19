import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

config({ path: ".env" });

const sqlPath = resolve("supabase/migrations/002_storage.sql");
const sql = readFileSync(sqlPath, "utf8");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  console.log("Applied", sqlPath);
} finally {
  await pool.end();
}
