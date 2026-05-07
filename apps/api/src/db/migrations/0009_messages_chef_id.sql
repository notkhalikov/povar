ALTER TABLE "messages"
  ADD COLUMN "chef_id" integer REFERENCES "users"("id");
