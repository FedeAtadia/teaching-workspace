DROP TABLE "enrollments" CASCADE;--> statement-breakpoint
ALTER TABLE "classes" DROP CONSTRAINT "classes_academic_year_id_academic_years_id_fk";
--> statement-breakpoint
ALTER TABLE "classes" DROP COLUMN "academic_year_id";--> statement-breakpoint
ALTER TABLE "classes" DROP COLUMN "section";