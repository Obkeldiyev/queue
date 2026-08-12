import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Find both duplicates
const dupes = await prisma.companyUser.findMany({
  where: { email: "obkeldiyevgiga13@gmail.com" },
  include: { roles: { include: { company_role: true } } },
  orderBy: { created_at: "asc" },
});

console.log("Duplicate accounts:");
dupes.forEach(u => {
  const roles = u.roles.map(r => r.company_role.type).join(", ") || "none";
  console.log(`  ID: ${u.id}  Name: ${u.first_name} ${u.last_name}  Roles: ${roles}  Created: ${u.created_at}`);
});

// The "John Doe" COMPANY_ADMIN duplicate — delete it or rename it
const johnDoe = dupes.find(u => u.first_name === "John" && u.last_name === "Doe");
const operator = dupes.find(u => u.roles.some(r => r.company_role.type === "OPERATOR"));

if (johnDoe && operator && johnDoe.id !== operator.id) {
  // Change John Doe's email so it doesn't conflict, then delete it
  await prisma.companyUser.delete({ where: { id: johnDoe.id } });
  console.log(`\n✅ Deleted duplicate "John Doe" (${johnDoe.id})`);
  console.log(`   Operator account "${operator.first_name} ${operator.last_name}" (${operator.id}) is now the only one with this email.`);
} else if (dupes.length === 2) {
  // Just delete the first (older) non-operator one
  const toDelete = dupes[0].id === operator?.id ? dupes[1] : dupes[0];
  await prisma.companyUser.delete({ where: { id: toDelete.id } });
  console.log(`\n✅ Deleted duplicate account: ${toDelete.first_name} ${toDelete.last_name} (${toDelete.id})`);
} else {
  console.log("\nNo action taken — couldn't identify which to delete safely.");
}

const remaining = await prisma.companyUser.findMany({
  where: { email: "obkeldiyevgiga13@gmail.com" },
  include: { roles: { include: { company_role: true } } },
});
console.log(`\nRemaining accounts with this email: ${remaining.length}`);
remaining.forEach(u => {
  const roles = u.roles.map(r => r.company_role.type).join(", ") || "none";
  console.log(`  ${u.first_name} ${u.last_name} | ${roles} | status: ${u.status}`);
});

await prisma.$disconnect();
