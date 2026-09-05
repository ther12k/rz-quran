// Applies generated migrations in order. Uses the drizzle migrator, which
// records applied entries in drizzle.__drizzle_migrations.
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./index.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDatabase(databaseUrl);
console.log("Applying migrations from packages/database/migrations …");
await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
console.log("Migrations applied.");
process.exit(0);
