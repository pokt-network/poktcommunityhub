import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

try {
  const res = await pool.query(`
    UPDATE public.submissions
    SET reviewed_by = (
      SELECT id FROM public."user" WHERE role = 'admin' ORDER BY "createdAt" ASC LIMIT 1
    )
    WHERE reviewed_by IS NULL AND status IN ('approved', 'rejected')
    RETURNING id;
  `);
  console.log("Backfilled submissions with reviewer:", res.rowCount);
} finally {
  await pool.end();
}
