ALTER TABLE "schools" ADD COLUMN "pass_mark" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "follow_up" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "follow_up_missing" integer DEFAULT 3 NOT NULL;