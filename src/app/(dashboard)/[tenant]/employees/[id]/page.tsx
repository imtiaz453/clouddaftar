import { getEmployee } from "@/actions/employees-hr";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helper";
import { EmployeeDetailClient } from "@/features/employees/employee-detail-client";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployee(id);
  const user = await getCurrentUser();
  const branches = user?.companyId ? await prisma.branch.findMany({ where: { companyId: user.companyId, isActive: true }, select: { id: true, name: true } }) : [];
  return <EmployeeDetailClient employee={JSON.parse(JSON.stringify(employee))} branches={branches} />;
}
