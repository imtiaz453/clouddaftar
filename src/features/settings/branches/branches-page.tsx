import { getBranches } from "@/actions/locations";
import { BranchesClient } from "./branches-client";
import { checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";

export async function BranchesPage() {
  try {
    const [branches, canManage] = await Promise.all([
      getBranches(),
      checkPermission(PERMISSIONS.BRANCHES_MANAGE),
    ]);
    return <BranchesClient branches={branches as any} canManage={canManage} />;
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load branches</p>
      </div>
    );
  }
}
