import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { SupplierStatementClient } from "./supplier-statement-client";

export async function SupplierStatementPage() {
  try {
    const user = await requireCompanyAuth();
    const suppliers = await prisma.supplier.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return <SupplierStatementClient suppliers={suppliers} />;
  } catch {
    return <div className="flex h-[50vh] items-center justify-center"><p className="text-muted-foreground">Could not load</p></div>;
  }
}
