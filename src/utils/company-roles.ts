import prisma from "../prisma/client";

const DEFAULT_ROLE_DEFINITIONS = [
  {
    name: "Company Admin",
    type: "COMPANY_ADMIN" as const,
    description: "Full company administration",
    is_system: true,
  },
  {
    name: "Operator",
    type: "OPERATOR" as const,
    description: "Handles queue calls, service flow, and counter work",
    is_system: true,
  },
];

export async function ensureDefaultCompanyRoles(companyId: string) {
  const roles = [] as Array<{ id: string; name: string; type: string }>;

  for (const definition of DEFAULT_ROLE_DEFINITIONS) {
    let role = await prisma.companyRole.findFirst({
      where: { company_id: companyId, type: definition.type as any },
      select: { id: true, name: true, type: true },
    });

    if (!role) {
      role = await prisma.companyRole.create({
        data: {
          company_id: companyId,
          name: definition.name,
          type: definition.type as any,
          description: definition.description,
          is_system: definition.is_system,
        },
        select: { id: true, name: true, type: true },
      });
    } else if (role.name !== definition.name) {
      role = await prisma.companyRole.update({
        where: { id: role.id },
        data: { name: definition.name, description: definition.description, is_system: definition.is_system },
        select: { id: true, name: true, type: true },
      });
    }

    roles.push(role);
  }

  return roles;
}
