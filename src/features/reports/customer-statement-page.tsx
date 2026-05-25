import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { CustomerStatementClient } from "./customer-statement-client";

export async function CustomerStatementPage() {
  try {
    const user = await requireCompanyAuth();
    const customers = await prisma.customer.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return <CustomerStatementClient customers={customers} />;
  } catch {
    return <div className="flex h-[50vh] items-center justify-center"><p className="text-muted-foreground">Could not load</p></div>;
  }
}
