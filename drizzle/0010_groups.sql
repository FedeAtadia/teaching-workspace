CREATE TABLE "class_group_students" (
	"teacher_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "class_group_students_class_id_student_id_pk" PRIMARY KEY("class_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "class_group_students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "class_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"name" text NOT NULL,
	"days" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_groups" (
	"teacher_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"due_on" date,
	CONSTRAINT "task_groups_task_id_group_id_pk" PRIMARY KEY("task_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "task_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "class_group_students" ADD CONSTRAINT "class_group_students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_group_students" ADD CONSTRAINT "class_group_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_group_students" ADD CONSTRAINT "class_group_students_group_id_class_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_group_id_class_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_groups_class_name_ci" ON "class_groups" USING btree ("class_id",lower("name"));