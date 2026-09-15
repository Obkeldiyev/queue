ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "menu_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_menu_id_fkey'
  ) THEN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tickets_menu_id_idx" ON "tickets"("menu_id");
