CREATE TABLE "service_conversations" (
 "id" UUID NOT NULL, "company_id" UUID NOT NULL, "operator_id" UUID NOT NULL,
 "branch_id" UUID, "token" TEXT NOT NULL, "customer_name" TEXT,
 "channel" TEXT NOT NULL DEFAULT 'online', "evidence" JSONB,
 "status" TEXT NOT NULL DEFAULT 'INVITED', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "completed_at" TIMESTAMP(3), PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "service_conversations_token_key" ON "service_conversations"("token");
CREATE INDEX "service_conversations_company_id_operator_id_created_at_idx" ON "service_conversations"("company_id","operator_id","created_at");
CREATE TABLE "service_messages" (
 "id" UUID NOT NULL, "conversation_id" UUID NOT NULL, "sender" TEXT NOT NULL,
 "text" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY("id"), FOREIGN KEY("conversation_id") REFERENCES "service_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "service_messages_conversation_id_created_at_idx" ON "service_messages"("conversation_id","created_at");
ALTER TABLE "menus" ADD COLUMN IF NOT EXISTS "name_uz" VARCHAR(120);
ALTER TABLE "menus" ADD COLUMN IF NOT EXISTS "name_ru" VARCHAR(120);
ALTER TABLE "menus" ADD COLUMN IF NOT EXISTS "name_en" VARCHAR(120);
