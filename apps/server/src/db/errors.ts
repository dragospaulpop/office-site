// apps/server/src/db/errors.ts — which SQLite errors are the client's fault
import { SQLiteError } from "bun:sqlite";

// REFERENCES refused the write: a missing parent, or a parent with children
export function isForeignKeyError(error: unknown): boolean {
  return (
    error instanceof SQLiteError &&
    error.code === "SQLITE_CONSTRAINT_FOREIGNKEY"
  );
}
