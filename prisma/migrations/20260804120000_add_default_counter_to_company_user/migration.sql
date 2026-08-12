-- Add default_counter_id to company_users
ALTER TABLE "company_users" ADD COLUMN IF NOT EXISTS "default_counter_id" UUID;
ALTER TABLE "company_users" DROP CONSTRAINT IF EXISTS "company_users_default_counter_id_fkey";
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_default_counter_id_fkey" FOREIGN KEY ("default_counter_id") REFERENCES "counters"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_company_users_default_counter_id" ON "company_users" ("default_counter_id");
