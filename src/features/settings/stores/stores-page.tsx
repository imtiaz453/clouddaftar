import { getStores, getBranchesList, getEmployeesList } from "@/actions/locations";
import { StoresClient } from "./stores-client";

export async function StoresPage() {
  try {
    const [stores, branches, employees] = await Promise.all([
      getStores(),
      getBranchesList(),
      getEmployeesList(),
    ]);
    return (
      <StoresClient
        stores={stores as any}
        branches={branches as any}
        employees={employees as any}
      />
    );
  } catch (e) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load stores</p>
      </div>
    );
  }
}
