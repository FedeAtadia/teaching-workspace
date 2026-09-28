CREATE TYPE "public"."shift" AS ENUM('morning', 'afternoon', 'evening');--> statement-breakpoint
CREATE TABLE "course_students" (
	"teacher_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"joined_on" date DEFAULT current_date,
	CONSTRAINT "course_students_course_id_student_id_pk" PRIMARY KEY("course_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "course_students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"division" text NOT NULL,
	"shift" "shift" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_teacher_id_academic_year_id_year_division_shift_unique" UNIQUE("teacher_id","academic_year_id","year","division","shift")
);
--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "course_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "course_students" ADD CONSTRAINT "course_students_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_students" ADD CONSTRAINT "course_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_teacher_id_name_unique" UNIQUE("teacher_id","name");--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_course_id_name_unique" UNIQUE("course_id","name");