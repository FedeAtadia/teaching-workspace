CREATE TABLE "follow_up_dismissals" (
	"teacher_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"term" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_dismissals_class_id_student_id_term_pk" PRIMARY KEY("class_id","student_id","term")
);
--> statement-breakpoint
ALTER TABLE "follow_up_dismissals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "follow_up_dismissals" ADD CONSTRAINT "follow_up_dismissals_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_dismissals" ADD CONSTRAINT "follow_up_dismissals_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;