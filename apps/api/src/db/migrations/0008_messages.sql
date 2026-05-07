CREATE TABLE IF NOT EXISTS "messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer REFERENCES "orders"("id"),
  "request_id" integer REFERENCES "requests"("id"),
  "sender_id" integer NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "messages_parent_check"
    CHECK ("order_id" IS NOT NULL OR "request_id" IS NOT NULL)
);
