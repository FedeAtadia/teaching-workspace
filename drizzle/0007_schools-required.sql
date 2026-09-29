ALTER TABLE "courses" DROP CONSTRAINT "courses_teacher_id_academic_year_id_year_division_shift_unique";--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "school_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" DROP COLUMN "school";--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_school_id_academic_year_id_year_division_shift_unique" UNIQUE("teacher_id","school_id","academic_year_id","year","division","shift");