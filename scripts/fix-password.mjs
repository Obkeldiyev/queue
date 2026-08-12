// Usage: node scripts/fix-password.mjs [email] [newpassword]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(plain, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(plain, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.pbkdf2Sync(plain, salt, 100_000, 64, "sha512").toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
  } catch { return false; }
}

const prisma = new PrismaClient();
const [,, email, newPassword] = process.argv;

const users = await prisma.companyUser.findMany({
  select: {
    id: true, email: true, first_name: true, last_name: true,
    status: true, company_id: true, created_at: true,
    roles: { include: { company_role: { select: { name: true, type: true } } } },
  },
  orderBy: { created_at: "asc" }, // oldest first = same order backend findFirst returns
  take: 20,
});

console.log("\n=== Company Users (oldest first = login order) ===");
users.forEach((u, i) => {
  const roles = u.roles.map(r => r.company_role.type).join(", ") || "none";
  const dup = users.filter(x => x.email === u.email).length > 1 ? " ⚠️ DUPLICATE EMAIL" : "";
  console.log(`  ${i+1}. ${u.email.padEnd(38)} | ${u.status.padEnd(8)} | ${u.first_name} ${u.last_name} | ${roles}${dup}`);
});

if (email && newPassword) {
  // Reset password on ALL users with this email
  const matches = await prisma.companyUser.findMany({ where: { email } });
  console.log(`\nFound ${matches.length} user(s) with email ${email}`);
  for (const user of matches) {
    const hash = hashPassword(newPassword);
    await prisma.companyUser.update({ where: { id: user.id }, data: { password_hash: hash } });
    const updated = await prisma.companyUser.findUnique({ where: { id: user.id } });
    const ok = verifyPassword(newPassword, updated.password_hash);
    console.log(`  ✅ Reset ${user.first_name} ${user.last_name} (${user.id.slice(0,8)}) — verify: ${ok ? "PASS" : "FAIL"}`);
  }
}

await prisma.$disconnect();
