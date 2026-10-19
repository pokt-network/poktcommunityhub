import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const users = await pool.query(
    `SELECT id, name, role, "discordId" FROM public."user"`,
  );
  const accounts = await pool.query(
    `SELECT id, "userId", "providerId", "accountId" FROM public.account`,
  );
  console.log("users", users.rows);
  console.log("accounts", accounts.rows);
} finally {
  await pool.end();
}
