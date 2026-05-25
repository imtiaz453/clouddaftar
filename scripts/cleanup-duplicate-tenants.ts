import { prisma } from "../src/lib/prisma";

async function main() {
  const duplicates = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
    SELECT LOWER(name) as name, COUNT(*)::int as count
    FROM companies WHERE "deletedAt" IS NULL
    GROUP BY LOWER(name) HAVING COUNT(*) > 1
  `;

  if (duplicates.length === 0) {
    console.log("No duplicate company names found.");
    return;
  }

  for (const dup of duplicates) {
    const companies = await prisma.company.findMany({
      where: { name: { equals: dup.name, mode: "insensitive" }, deletedAt: null },
      include: { subscription: { include: { plan: true } }, _count: { select: { members: true, products: true, sales: true, invoices: true } } },
      orderBy: { createdAt: "desc" },
    });

    console.log(`\n=== "${companies[0].name}" (${companies.length} entries) ===`);
    for (const c of companies) {
      const sub = c.subscription;
      console.log(`  ID: ${c.id}`);
      console.log(`  Slug: ${c.slug}`);
      console.log(`  Created: ${c.createdAt.toISOString().split("T")[0]}`);
      console.log(`  Subscription: ${sub ? `${sub.status} (${sub.plan?.name || "N/A"})` : "NONE"}`);
      console.log(`  Members: ${c._count.members}, Products: ${c._count.products}, Sales: ${c._count.sales}, Invoices: ${c._count.invoices}`);
    }
  }

  // Delete companies with TRIAL subscription when an ACTIVE one exists with the same name
  for (const dup of duplicates) {
    const companies = await prisma.company.findMany({
      where: { name: { equals: dup.name, mode: "insensitive" }, deletedAt: null },
      include: { subscription: true },
    });

    const active = companies.find((c) => c.subscription?.status === "ACTIVE");
    const trial = companies.find((c) => c.subscription?.status === "TRIAL" && c.id !== active?.id);

    if (active && trial) {
      console.log(`\n>>> Deleting trial company: ${trial.name} (${trial.slug}) - ID: ${trial.id}`);
      await prisma.company.update({
        where: { id: trial.id },
        data: { deletedAt: new Date() },
      });
      console.log(`    Soft-deleted. Active company kept: ${active.name} (${active.slug})`);
    }
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
