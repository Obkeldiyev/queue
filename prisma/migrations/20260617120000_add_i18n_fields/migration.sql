-- Add i18n fields to branches
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "name_uz" VARCHAR(200);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "name_ru" VARCHAR(200);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "name_en" VARCHAR(200);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "address_uz" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "address_ru" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "address_en" TEXT;

-- Copy existing name/address into _uz columns
UPDATE "branches" SET "name_uz" = "name" WHERE "name_uz" IS NULL;
UPDATE "branches" SET "address_uz" = "address" WHERE "address_uz" IS NULL AND "address" IS NOT NULL;

-- Drop old columns
ALTER TABLE "branches" DROP COLUMN IF EXISTS "name";
ALTER TABLE "branches" DROP COLUMN IF EXISTS "address";

-- Make name_uz NOT NULL after fill
ALTER TABLE "branches" ALTER COLUMN "name_uz" SET NOT NULL;

-- Add i18n fields to services
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "name_uz" VARCHAR(200);
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "name_ru" VARCHAR(200);
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "name_en" VARCHAR(200);
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "description_uz" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "description_ru" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "description_en" TEXT;

UPDATE "services" SET "name_uz" = "name" WHERE "name_uz" IS NULL;
UPDATE "services" SET "description_uz" = "description" WHERE "description_uz" IS NULL AND "description" IS NOT NULL;

ALTER TABLE "services" DROP COLUMN IF EXISTS "name";
ALTER TABLE "services" DROP COLUMN IF EXISTS "description";

ALTER TABLE "services" ALTER COLUMN "name_uz" SET NOT NULL;

-- Add i18n fields to queue_groups
ALTER TABLE "queue_groups" ADD COLUMN IF NOT EXISTS "name_uz" VARCHAR(200);
ALTER TABLE "queue_groups" ADD COLUMN IF NOT EXISTS "name_ru" VARCHAR(200);
ALTER TABLE "queue_groups" ADD COLUMN IF NOT EXISTS "name_en" VARCHAR(200);

UPDATE "queue_groups" SET "name_uz" = "name" WHERE "name_uz" IS NULL;

ALTER TABLE "queue_groups" DROP COLUMN IF EXISTS "name";

ALTER TABLE "queue_groups" ALTER COLUMN "name_uz" SET NOT NULL;

-- Add i18n fields to counters
ALTER TABLE "counters" ADD COLUMN IF NOT EXISTS "name_uz" VARCHAR(100);
ALTER TABLE "counters" ADD COLUMN IF NOT EXISTS "name_ru" VARCHAR(100);
ALTER TABLE "counters" ADD COLUMN IF NOT EXISTS "name_en" VARCHAR(100);

UPDATE "counters" SET "name_uz" = "name" WHERE "name_uz" IS NULL;

ALTER TABLE "counters" DROP COLUMN IF EXISTS "name";

ALTER TABLE "counters" ALTER COLUMN "name_uz" SET NOT NULL;
