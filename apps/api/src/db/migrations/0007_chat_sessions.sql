CREATE TABLE IF NOT EXISTS "chat_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer NOT NULL,
  "initiator_telegram_id" bigint NOT NULL,
  "recipient_telegram_id" bigint NOT NULL,
  "role" varchar(20) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_sessions_initiator_idx"
  ON "chat_sessions" ("initiator_telegram_id");
