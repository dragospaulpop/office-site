// apps/server/src/db/buildings.ts — the SQL for buildings; routes call these functions
import type { Building, NewBuilding } from "@office/shared";
import { db } from "../db";

const COLUMNS = "id, name, city, year_built AS yearBuilt";

export function listBuildings(): Building[] {
  return db
    .query<Building, []>(`SELECT ${COLUMNS} FROM buildings ORDER BY name`)
    .all();
}

export function createBuilding(building: NewBuilding): Building {
  // RETURNING hands back the row as stored, id included
  const row = db
    .query<Building, [string, string, number | null]>(
      `INSERT INTO buildings (name, city, year_built) VALUES (?, ?, ?) RETURNING ${COLUMNS}`
    )
    .get(building.name, building.city, building.yearBuilt);
  if (!row) {
    throw new Error("INSERT … RETURNING gave no row");
  }
  return row;
}

// the number of rows deleted: 0 when there was no such building
export function deleteBuilding(id: number): number {
  return db.query("DELETE FROM buildings WHERE id = ?").run(id).changes;
}
