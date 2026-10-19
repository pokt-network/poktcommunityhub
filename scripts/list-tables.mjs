import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY 1
`);
console.log(result.rows);
const cols = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'user'
  ORDER BY ordinal_position
`);
console.log("user columns:", cols.rows);
await pool.end();
