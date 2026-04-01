ALTER TABLE "reviews" ADD COLUMN "chef_reply" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "report_count" integer DEFAULT 0 NOT NULL;
