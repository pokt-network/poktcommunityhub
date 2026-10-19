import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

try {
  const { rows } = await pool.query(`
    SELECT
      id,
      name,
      email,
      role,
      "discordId",
      COALESCE("totalXp", 0)::int AS "totalXp",
      "createdAt"
    FROM public."user"
    ORDER BY "createdAt" DESC NULLS LAST
  `);

  for (const row of rows) {
    console.log(
      [
        row.role,
        row.totalXp + " XP",
        row.name,
        row.email,
        row.discordId ?? "no-discord",
        row.id,
      ].join(" | "),
    );
  }
  console.log("---");
  console.log("count:", rows.length);
} finally {
  await pool.end();
}
