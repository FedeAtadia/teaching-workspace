ALTER TABLE "classes" ALTER COLUMN "pass_mark" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "value" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "observations" ALTER COLUMN "value" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "value" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "grade_min" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "grade_min" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "grade_max" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "grade_max" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "pass_mark" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "pass_mark" SET DEFAULT 7;--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "max_term_increase" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "max_term_increase" SET DEFAULT 3;--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "max_term_decrease" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "teacher_settings" ALTER COLUMN "max_term_decrease" SET DEFAULT 3;--> statement-breakpoint
ALTER TABLE "term_grades" ALTER COLUMN "value" SET DATA TYPE numeric(5, 2);