ALTER TABLE "course_students" ADD COLUMN "outcome_on" date;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "graduate_retention_months" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "graduates_deleted" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "graduates_deleted_on" date;--> statement-breakpoint
-- Outcomes set before this migration count from the day it is applied, so nobody is deleted early (KEEP-1).
UPDATE "course_students" SET "outcome_on" = current_date WHERE "outcome" IS NOT NULL;
