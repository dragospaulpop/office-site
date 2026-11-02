// apps/server/src/db/surveys.ts — the queries for surveys; routes call these functions
import type { NewSurvey, Survey } from "@office/shared";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { surveys } from "./schema";

export function listSurveys(entranceId?: string): Survey[] {
  return db
    .select()
    .from(surveys)
    .where(entranceId ? eq(surveys.entranceId, entranceId) : undefined)
    .orderBy(asc(surveys.surveyedOn))
    .all();
}

export function createSurvey(survey: NewSurvey): Survey {
  return db.insert(surveys).values(survey).returning().get();
}
