import { getPaymentHistoryReport } from "@/actions/accounting";
import { getCustomers } from "@/actions/sales";
import { CustomerPaymentsClient } from "./customer-payments-client";
import { serialize } from "@/lib/serialize";

export async function CustomerPaymentsPage() {
  try {
    const [payments, customers] = await Promise.all([
      getPaymentHistoryReport({ pageSize: 100, paymentType: "customer" }),
      getCustomers(),
    ]);

    return (
      <CustomerPaymentsClient
        payments={serialize(payments)}
        customers={serialize(customers)}
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
