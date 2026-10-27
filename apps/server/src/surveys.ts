// apps/server/src/surveys.ts — the surveys API; the SQL lives in src/db/
import { fieldErrors, NewSurvey } from "@office/shared";
import { Hono } from "hono";
import { isForeignKeyError } from "./db/errors";
import { createSurvey, listSurveys } from "./db/surveys";

export const surveysApi = new Hono();

// GET /api/surveys?entranceId=2 lists one entrance's surveys
surveysApi.get("/", (c) => {
  const entranceId = c.req.query("entranceId");
  return c.json(listSurveys(entranceId ? Number(entranceId) : undefined));
});

surveysApi.post("/", async (c) => {
  const result = NewSurvey.safeParse(await c.req.json().catch(() => null));
  if (!result.success) {
    return c.json({ errors: fieldErrors(result.error) }, 400);
  }
  try {
    return c.json(createSurvey(result.data), 201);
  } catch (error) {
    if (isForeignKeyError(error)) {
      return c.json({ errors: { entranceId: ["No such entrance"] } }, 400);
    }
    throw error;
  }
});
