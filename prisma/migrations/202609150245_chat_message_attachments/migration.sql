ALTER TABLE "service_messages" ADD COLUMN IF NOT EXISTS "attachment" JSONB;
ALTER TABLE "service_messages" ALTER COLUMN "text" SET DEFAULT '';
UPDATE "service_messages" SET "text" = '' WHERE "text" IS NULL;