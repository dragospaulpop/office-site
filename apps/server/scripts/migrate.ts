// apps/server/scripts/migrate.ts — apply every drizzle/NNNN_*.sql once, in order
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { migrate as applyMigrations } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "../src/db";

export function migrate() {
  // Drizzle records each file it applied in __drizzle_migrations
  applyMigrations(db, {
    migrationsFolder: join(import.meta.dir, "../drizzle"),
  });
}

if (import.meta.main) {
  migrate();
  const [applied] = db.all<{ count: number }>(
    sql`SELECT count(*) AS count FROM __drizzle_migrations`
  );
  console.log(`${applied?.count} migration(s) in the database`);
}
