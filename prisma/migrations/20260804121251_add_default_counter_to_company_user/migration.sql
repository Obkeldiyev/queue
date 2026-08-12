-- DropForeignKey
ALTER TABLE "company_users" DROP CONSTRAINT "company_users_default_counter_id_fkey";

-- DropIndex
DROP INDEX "idx_company_users_default_counter_id";
