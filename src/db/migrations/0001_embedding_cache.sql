CREATE TABLE "embedding_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"embedding" halfvec(2048) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
