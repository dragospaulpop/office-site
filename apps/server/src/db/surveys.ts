// apps/server/src/db/surveys.ts — the SQL for surveys; routes call these functions
import type { NewSurvey, Survey } from "@office/shared";
import { db } from "../db";

const COLUMNS =
  "id, entrance_id AS entranceId, surveyed_on AS surveyedOn, surveyor, notes";

export function listSurveys(entranceId?: number): Survey[] {
  if (entranceId === undefined) {
    return db
      .query<Survey, []>(`SELECT ${COLUMNS} FROM surveys ORDER BY id`)
      .all();
  }
  return db
    .query<Survey, [number]>(
      `SELECT ${COLUMNS} FROM surveys WHERE entrance_id = ? ORDER BY id`
    )
    .all(entranceId);
}

export function createSurvey(survey: NewSurvey): Survey {
  const row = db
    .query<Survey, [number, string, string, string | null]>(
      `INSERT INTO surveys (entrance_id, surveyed_on, surveyor, notes)
       VALUES (?, ?, ?, ?) RETURNING ${COLUMNS}`
    )
    .get(survey.entranceId, survey.surveyedOn, survey.surveyor, survey.notes);
  if (!row) {
    throw new Error("INSERT … RETURNING gave no row");
  }
  return row;
}
