// apps/server/src/db.ts — the one connection to the database file, opened once
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";

// apps/server/data/, wherever the command was started from
const folder = join(import.meta.dir, "../data");
mkdirSync(folder, { recursive: true });

// bun test sets NODE_ENV=test: tests get a fresh, empty database in memory
const file =
  Bun.env.NODE_ENV === "test" ? ":memory:" : join(folder, "office.sqlite");

const sqlite = new Database(file, { create: true, strict: true });
// readers do not wait for the writer; see the course's WAL slide
sqlite.run("PRAGMA journal_mode = WAL;");
// SQLite ignores REFERENCES unless every connection turns this on
sqlite.run("PRAGMA foreign_keys = ON;");

// Drizzle on top of the same connection; createdAt in code, created_at in SQL
export const db = drizzle({ casing: "snake_case", client: sqlite });
