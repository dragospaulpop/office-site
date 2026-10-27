// apps/server/src/buildings.ts — the buildings API; the SQL lives in src/db/
import { fieldErrors, NewBuilding } from "@office/shared";
import { Hono } from "hono";
import { createBuilding, deleteBuilding, listBuildings } from "./db/buildings";
import { isForeignKeyError } from "./db/errors";

export const buildingsApi = new Hono();

buildingsApi.get("/", (c) => c.json(listBuildings()));

buildingsApi.post("/", async (c) => {
  const result = NewBuilding.safeParse(await c.req.json().catch(() => null));
  if (!result.success) {
    return c.json({ errors: fieldErrors(result.error) }, 400);
  }
  return c.json(createBuilding(result.data), 201);
});

buildingsApi.delete("/:id", (c) => {
  try {
    if (deleteBuilding(Number(c.req.param("id"))) === 0) {
      return c.json({ error: "No such building" }, 404);
    }
    return c.body(null, 204);
  } catch (error) {
    // entrances still point at it: the foreign key refuses the delete
    if (isForeignKeyError(error)) {
      return c.json({ error: "The building still has entrances" }, 409);
    }
    throw error;
  }
});
