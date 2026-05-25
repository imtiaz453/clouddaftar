import { getUsers, getInvitations } from "@/actions/users";
import { getCompanySettings } from "@/actions/settings";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helper";
import { UsersClient } from "./users-client";
import { serialize } from "@/lib/serialize";

export async function UsersPage() {
  try {
    const [users, invitations, company] = await Promise.all([
      getUsers(),
      getInvitations(),
      getCompanySettings().catch(() => null),
    ]);
    const rolePermissions = company?.settings?.rolePermissions
      ? (serialize(company.settings.rolePermissions) as Record<string, string[]>)
      : null;
    const user = await getCurrentUser();
    const branches = user?.companyId
      ? await prisma.branch.findMany({ where: { companyId: user.companyId, isActive: true }, select: { id: true, name: true } })
      : [];
    return (
      <UsersClient users={users} invitations={invitations} rolePermissions={rolePermissions} branches={branches} />
    );
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load</p>
      </div>
    );
  }
}
