CREATE TYPE "public"."user_role" AS ENUM('customer', 'chef', 'support', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'banned');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "chef_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bio" text,
	"cuisine_tags" text[] DEFAULT '{}' NOT NULL,
	"work_formats" text[] DEFAULT '{}' NOT NULL,
	"districts" text[] DEFAULT '{}' NOT NULL,
	"avg_price" numeric(10, 2),
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rating_cache" numeric(3, 2) DEFAULT '0' NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"portfolio_media_ids" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"lang" varchar(10) DEFAULT 'ru',
	"city" varchar(100),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"utm_content" varchar(100),
	"utm_term" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "chef_profiles" ADD CONSTRAINT "chef_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;