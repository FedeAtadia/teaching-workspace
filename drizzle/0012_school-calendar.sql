CREATE TYPE "public"."day_off_kind" AS ENUM('holiday', 'jornada', 'recess', 'other');--> statement-breakpoint
CREATE TABLE "school_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"term2_starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	CONSTRAINT "school_calendars_school_id_academic_year_id_unique" UNIQUE("school_id","academic_year_id")
);
--> statement-breakpoint
ALTER TABLE "school_calendars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "school_days_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"kind" "day_off_kind" NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "school_days_off" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "class_groups" ADD COLUMN "weekdays" smallint[] DEFAULT '{}'::smallint[] NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "weekdays" smallint[] DEFAULT '{}'::smallint[] NOT NULL;--> statement-breakpoint
ALTER TABLE "school_calendars" ADD CONSTRAINT "school_calendars_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_calendars" ADD CONSTRAINT "school_calendars_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_days_off" ADD CONSTRAINT "school_days_off_calendar_id_school_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."school_calendars"("id") ON DELETE cascade ON UPDATE no action;