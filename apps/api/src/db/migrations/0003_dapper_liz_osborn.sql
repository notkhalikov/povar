CREATE TABLE "chat_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"initiator_telegram_id" bigint NOT NULL,
	"recipient_telegram_id" bigint NOT NULL,
	"role" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_sessions_initiator_telegram_id_unique" UNIQUE("initiator_telegram_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"request_id" integer,
	"chef_id" integer,
	"sender_id" integer NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "messages_parent_check" CHECK ("messages"."order_id" IS NOT NULL OR "messages"."request_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "chef_profiles" ADD COLUMN "verification_document_id" text;--> statement-breakpoint
ALTER TABLE "chef_profiles" ADD COLUMN "verification_selfie_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "chat_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "review_reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "chef_reply" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "report_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chef_id_users_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;