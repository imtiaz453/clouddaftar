import { getPaymentHistoryReport } from "@/actions/accounting";
import { getSuppliers } from "@/actions/purchases";
import { SupplierPaymentsClient } from "./supplier-payments-client";
import { serialize } from "@/lib/serialize";

export async function SupplierPaymentsPage() {
  try {
    const [payments, suppliers] = await Promise.all([
      getPaymentHistoryReport({ pageSize: 100, paymentType: "supplier" }),
      getSuppliers(),
    ]);

    return (
      <SupplierPaymentsClient
        payments={serialize(payments)}
        suppliers={serialize(suppliers)}
      />
    );
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load</p>
      </div>
    );
  }
}
