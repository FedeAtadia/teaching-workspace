CREATE TABLE "student_adaptations" (
	"teacher_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"notes" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_adaptations_class_id_student_id_pk" PRIMARY KEY("class_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "student_adaptations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "adapted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "standards" ADD COLUMN "student_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "adapted_description" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "adapted_criteria" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "adapted_attachment_path" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "adapted_attachment_name" text;--> statement-breakpoint
ALTER TABLE "student_adaptations" ADD CONSTRAINT "student_adaptations_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_adaptations" ADD CONSTRAINT "student_adaptations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;