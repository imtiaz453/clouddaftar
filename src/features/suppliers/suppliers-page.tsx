import { getSuppliers } from "@/actions/purchases";
import { SuppliersClient } from "./suppliers-client";
import { serialize } from "@/lib/serialize";

export async function SuppliersPage() {
  try {
    const suppliers = serialize(await getSuppliers());
    return <SuppliersClient suppliers={suppliers} />;
  } catch {
    return <div className="flex h-[50vh] items-center justify-center"><p className="text-muted-foreground">Could not load</p></div>;
  }
}
