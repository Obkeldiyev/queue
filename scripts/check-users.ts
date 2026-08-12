import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/utils/password";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.companyUser.findMany({
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      status: true,
      password_hash: true,
      company_id: true,
      roles: { include: { company_role: true } },
    },
    orderBy: { created_at: "desc" },
    take: 20,
  });

  console.log("\n=== COMPANY USERS ===");
  for (const u of users) {
    const roleNames = u.roles.map((r) => r.company_role.type).join(", ");
    const hashPreview = u.password_hash?.substring(0, 40) + "...";
    console.log(`
  Email:    ${u.email}
  Name:     ${u.first_name} ${u.last_name}
  Status:   ${u.status}
  Roles:    ${roleNames || "none"}
  Hash:     ${hashPreview}
  CompanyId:${u.company_id}
`);
  }

  // Test a specific password — change this to what you're typing
  const testEmail = process.argv[2];
  const testPassword = process.argv[3];

  if (testEmail && testPassword) {
    const user = await prisma.companyUser.findFirst({ where: { email: testEmail } });
    if (!user) {
      console.log(`\n❌ No user found with email: ${testEmail}`);
    } else {
      const ok = verifyPassword(testPassword, user.password_hash);
      console.log(`\nPassword check for ${testEmail}: ${ok ? "✅ CORRECT" : "❌ WRONG"}`);

      if (!ok) {
        // Auto-fix: reset to the provided password
        const newHash = hashPassword(testPassword);
        await prisma.companyUser.update({
          where: { id: user.id },
          data: { password_hash: newHash },
        });
        console.log(`✅ Password has been reset to: "${testPassword}"`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
