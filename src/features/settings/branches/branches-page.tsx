import { getBranches } from "@/actions/locations";
import { BranchesClient } from "./branches-client";

export async function BranchesPage() {
  try {
    const branches = await getBranches();
    return <BranchesClient branches={branches as any} />;
  } catch (e) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load branches</p>
      </div>
    );
  }
}
