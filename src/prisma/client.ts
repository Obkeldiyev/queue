// Import directly from the generated Prisma client to avoid re-export resolution issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("../../node_modules/.prisma/client/index.js") as
  typeof import("../../node_modules/.prisma/client/index");

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClientInstance | undefined;
}

const prismaInstance: PrismaClientInstance =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prismaInstance;
}

export { prismaInstance as prisma };
export default prismaInstance;
