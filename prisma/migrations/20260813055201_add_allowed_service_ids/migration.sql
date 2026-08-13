-- AlterTable
ALTER TABLE "company_users" ADD COLUMN     "allowed_service_ids" JSONB;

-- CreateIndex
CREATE INDEX "company_users_email_idx" ON "company_users"("email");
