/**
 * First-time seed script — run ONCE after `prisma migrate deploy`
 * Creates the super admin account.
 *
 * Usage:  npx ts-node -r tsconfig-paths/register src/scripts/seed.ts
 *
 * After running this script, log in to the admin UI at /login
 * as admin@qubit.io / Admin123!  then change the password.
 */
import prisma from "../prisma/client";
import { hashPassword } from "../utils/password";

async function main() {
  const existing = await prisma.platformUser.count();
  if (existing > 0) {
    console.log("✓ Platform admin already exists — skipping seed.");
    return;
  }

  const admin = await prisma.platformUser.create({
    data: {
      first_name: "Super",
      last_name:  "Admin",
      email:      "admin@qubit.io",
      password_hash: hashPassword("Admin123!"),
    },
  });

  console.log("✅ Super Admin created:");
  console.log(`   Email   : ${admin.email}`);
  console.log(`   Password: Admin123!  ← change this after first login`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Start backend:  npm run dev");
  console.log("  2. Start frontend: npm run dev  (queue_front folder)");
  console.log("  3. Open http://localhost:3000 → login as admin@qubit.io");
  console.log("  4. Create a Company → Create a Branch → Create Services → Create Queues");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
