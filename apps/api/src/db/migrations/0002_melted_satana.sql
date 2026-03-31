CREATE TYPE "public"."chef_response_status" AS ENUM('new', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."dispute_opened_by" AS ENUM('customer', 'chef');--> statement-breakpoint
CREATE TYPE "public"."dispute_resolution_type" AS ENUM('full_refund', 'partial_refund', 'no_refund');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'awaiting_other_party', 'support_review', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."request_format" AS ENUM('home_visit', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "chef_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"chef_id" integer NOT NULL,
	"proposed_price" numeric(10, 2),
	"comment" text,
	"status" "chef_response_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"opened_by" "dispute_opened_by" NOT NULL,
	"reason_code" varchar(100) NOT NULL,
	"description" text,
	"attachments" text[] DEFAULT '{}' NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolution_type" "dispute_resolution_type",
	"resolution_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"city" varchar(100) NOT NULL,
	"district" varchar(100),
	"scheduled_at" timestamp NOT NULL,
	"format" "request_format" NOT NULL,
	"persons" integer NOT NULL,
	"description" text,
	"budget" numeric(10, 2),
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"chef_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"tags_quality" text[] DEFAULT '{}' NOT NULL,
	"text" text,
	"photo_ids" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "chef_responses" ADD CONSTRAINT "chef_responses_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chef_responses" ADD CONSTRAINT "chef_responses_chef_id_users_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_chef_id_users_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;