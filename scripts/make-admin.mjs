import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });

const identifier = process.argv[2];
const roleArg = (process.argv[3] ?? "admin").trim().toLowerCase();
const role =
  roleArg === "ambassador" || roleArg === "--revoke" || roleArg === "revoke"
    ? "ambassador"
    : roleArg === "admin"
      ? "admin"
      : null;

if (!identifier || !role) {
  console.error(
    "Usage: node scripts/make-admin.mjs <discordId|email> [admin|ambassador|--revoke]",
  );
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

try {
  const { rows } = await pool.query(
    `UPDATE public."user"
     SET role = $2, "updatedAt" = now()
     WHERE "discordId" = $1 OR lower(email) = lower($1)
     RETURNING name, email, role, "discordId"`,
    [identifier, role],
  );
  console.log(
    rows.length ? rows[0] : "No user found for that Discord id or email",
  );
} finally {
  await pool.end();
}
