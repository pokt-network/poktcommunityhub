import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  for (const table of ["user", "account", "session"]) {
    const { rows } = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table],
    );
    console.log("\n==", table, "==");
    console.log(rows);
  }
} finally {
  await pool.end();
}
