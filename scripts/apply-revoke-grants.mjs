import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

config({ path: ".env" });

const sqlPath = resolve("supabase/migrations/008_revoke_public_grants.sql");
const sql = readFileSync(sqlPath, "utf8");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  await pool.query(sql);
  console.log("Applied", sqlPath);

  const grants = await pool.query(`
    SELECT
      table_name,
      grantee,
      string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated', 'PUBLIC')
    GROUP BY table_name, grantee
    ORDER BY table_name, grantee
  `);
  console.log("Remaining grants to anon / authenticated / PUBLIC:");
  console.table(grants.rows);
} finally {
  await pool.end();
}
