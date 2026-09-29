-- SCHOOL-4: courses created before schools existed go under "Mi escuela",
-- one per teacher who has any, for the teacher to rename. Only courses with
-- no school are touched, so running this again changes nothing.
INSERT INTO "schools" ("teacher_id", "name")
SELECT DISTINCT "teacher_id", 'Mi escuela' FROM "courses" WHERE "school_id" IS NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "courses" AS c
SET "school_id" = s."id"
FROM "schools" AS s
WHERE c."school_id" IS NULL
  AND s."teacher_id" = c."teacher_id"
  AND lower(s."name") = 'mi escuela';
