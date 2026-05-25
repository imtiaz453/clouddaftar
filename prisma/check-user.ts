import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: "admin@clouddaftar.com" } });
  console.log("Found:", !!user);
  console.log("Name:", user?.name);
  console.log("Has password:", !!user?.passwordHash);
  if (user?.passwordHash) console.log("Hash starts with:", user.passwordHash.substring(0, 20));
  await prisma.$disconnect();
}
main();
