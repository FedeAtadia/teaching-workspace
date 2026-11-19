CREATE TYPE "public"."share_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TABLE "class_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"guest_email" text NOT NULL,
	"guest_id" uuid,
	"status" "share_status" DEFAULT 'pending' NOT NULL,
	"include_adaptations" boolean DEFAULT false NOT NULL,
	"owner_name" text,
	"guest_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "class_shares_class_id_guest_email_unique" UNIQUE("class_id","guest_email")
);
--> statement-breakpoint
ALTER TABLE "class_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "class_shares" ADD CONSTRAINT "class_shares_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;