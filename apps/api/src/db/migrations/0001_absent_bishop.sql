CREATE TYPE "public"."order_status" AS ENUM('draft', 'awaiting_payment', 'paid', 'in_progress', 'completed', 'dispute_pending', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('home_visit', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'paid', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."products_buyer" AS ENUM('customer', 'chef');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"chef_id" integer NOT NULL,
	"type" "order_type" NOT NULL,
	"city" varchar(100) NOT NULL,
	"district" varchar(100),
	"address" text,
	"scheduled_at" timestamp NOT NULL,
	"persons" integer NOT NULL,
	"description" text,
	"agreed_price" numeric(10, 2),
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"products_buyer" "products_buyer",
	"products_budget" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'GEL' NOT NULL,
	"provider" varchar(50) NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"provider_tx_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_chef_id_users_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;