CREATE TYPE "public"."resume_status" AS ENUM('queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."vector_kind" AS ENUM('whole', 'profile', 'skills', 'experience', 'education', 'job');--> statement-breakpoint
CREATE TABLE "resume_vectors" (
	"resume_id" text NOT NULL,
	"kind" vector_kind NOT NULL,
	"position" integer NOT NULL,
	"embedding" halfvec(2048) NOT NULL,
	CONSTRAINT "resume_vectors_resume_id_kind_position_pk" PRIMARY KEY("resume_id","kind","position")
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "resume_status" DEFAULT 'queued' NOT NULL,
	"data" jsonb,
	"source_text" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resumes_has_content" CHECK ("resumes"."data" IS NOT NULL OR "resumes"."source_text" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "resume_vectors" ADD CONSTRAINT "resume_vectors_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_vectors_whole_hnsw" ON "resume_vectors" USING hnsw ("embedding" halfvec_cosine_ops) WHERE kind = 'whole';--> statement-breakpoint
CREATE INDEX "resumes_queue" ON "resumes" USING btree ("status","created_at");