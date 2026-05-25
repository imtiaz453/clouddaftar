import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, requirePermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const user = await requireCompanyAuth();
    await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;
    const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : null;
    const department = typeof body.department === "string" ? body.department.trim() : null;
    const branchId =
      typeof body.branchId === "string" && body.branchId.trim() ? body.branchId.trim() : null;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Employee name is required" },
        { status: 400 },
      );
    }

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, companyId: user.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!branch) {
        return NextResponse.json({ success: false, error: "Branch not found" }, { status: 404 });
      }
    }

    const employee = await prisma.employeeRecord.create({
      data: {
        companyId: user.companyId,
        branchId,
        name,
        email,
        phone,
        jobTitle,
        department,
        employmentType:
          typeof body.employmentType === "string" && body.employmentType
            ? body.employmentType
            : "FULL_TIME",
        hasSystemAccess: false,
      },
    });

    await createAuditLog({
      userId: user.id,
      companyId: user.companyId,
      action: "CREATE",
      entity: "EmployeeRecord",
      entityId: employee.id,
      metadata: { name, email, type: "non_login_employee" },
    });

    return NextResponse.json({
      success: true,
      data: employee,
      message: "Employee record created",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create employee";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
