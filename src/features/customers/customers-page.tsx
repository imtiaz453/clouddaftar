import { getCustomers } from "@/actions/sales";
import { CustomersClient } from "./customers-client";
import { serialize } from "@/lib/serialize";

export async function CustomersPage() {
  try {
    const customers = serialize(await getCustomers());
    return <CustomersClient customers={customers} />;
  } catch {
    return <div className="flex h-[50vh] items-center justify-center"><p className="text-muted-foreground">Could not load</p></div>;
  }
}
