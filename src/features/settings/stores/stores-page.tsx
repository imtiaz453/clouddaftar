import { getStores, getBranchesList, getEmployeesList } from "@/actions/locations";
import { StoresClient } from "./stores-client";
import { checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";

export async function StoresPage() {
  try {
    const [stores, branches, employees, canManage] = await Promise.all([
      getStores(),
      getBranchesList(),
      getEmployeesList(),
      checkPermission(PERMISSIONS.STORES_MANAGE),
    ]);
    return (
      <StoresClient
        stores={stores as any}
        branches={branches as any}
        employees={employees as any}
        canManage={canManage}
      />
    );
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load stores</p>
      </div>
    );
  }
}
