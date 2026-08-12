-- AlterTable
ALTER TABLE "menus" ADD COLUMN     "queue_group_id" UUID;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_queue_group_id_fkey" FOREIGN KEY ("queue_group_id") REFERENCES "queue_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
