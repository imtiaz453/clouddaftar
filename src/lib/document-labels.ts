import type { RenderData, RenderOptions } from "@/lib/template-registry";

export type DocumentLabelKey =
  | "invoice"
  | "quotation"
  | "billTo"
  | "preparedFor"
  | "paymentDetails"
  | "quoteDetails"
  | "number"
  | "date"
  | "dueDate"
  | "validUntil"
  | "payment"
  | "preparedBy"
  | "customer"
  | "walkInCustomer"
  | "item"
  | "qty"
  | "price"
  | "tax"
  | "total"
  | "subtotal"
  | "discount"
  | "paid"
  | "due"
  | "amountDue"
  | "notes"
  | "terms"
  | "authorizedSignature"
  | "customerSignature"
  | "date"
  | "reference"
  | "description"
  | "debit"
  | "credit"
  | "balance"
  | "opening"
  | "closing"
  | "totalDebits"
  | "totalCredits"
  | "closingBalance";

const LABELS: Record<DocumentLabelKey, { en: string; ar: string }> = {
  invoice: { en: "Invoice", ar: "فاتورة" },
  quotation: { en: "Quotation", ar: "عرض سعر" },
  billTo: { en: "Bill To", ar: "فاتورة إلى" },
  preparedFor: { en: "Prepared For", ar: "مقدم إلى" },
  paymentDetails: { en: "Payment Details", ar: "تفاصيل الدفع" },
  quoteDetails: { en: "Quote Details", ar: "تفاصيل العرض" },
  number: { en: "Number", ar: "الرقم" },
  date: { en: "Date", ar: "التاريخ" },
  dueDate: { en: "Due Date", ar: "تاريخ الاستحقاق" },
  validUntil: { en: "Valid Until", ar: "صالح حتى" },
  payment: { en: "Payment", ar: "الدفع" },
  preparedBy: { en: "Prepared By", ar: "أعد بواسطة" },
  customer: { en: "Customer", ar: "العميل" },
  walkInCustomer: { en: "Walk-in Customer", ar: "عميل نقدي" },
  item: { en: "Item", ar: "الصنف" },
  qty: { en: "Qty", ar: "الكمية" },
  price: { en: "Price", ar: "السعر" },
  tax: { en: "Tax", ar: "الضريبة" },
  total: { en: "Total", ar: "الإجمالي" },
  subtotal: { en: "Subtotal", ar: "المجموع الفرعي" },
  discount: { en: "Discount", ar: "الخصم" },
  paid: { en: "Paid", ar: "المدفوع" },
  due: { en: "Due", ar: "المستحق" },
  amountDue: { en: "Amount Due", ar: "المبلغ المستحق" },
  notes: { en: "Notes", ar: "ملاحظات" },
  terms: { en: "Terms", ar: "الشروط" },
  authorizedSignature: { en: "Authorized Signature", ar: "توقيع المفوض" },
  customerSignature: { en: "Customer Signature", ar: "توقيع العميل" },
  reference: { en: "Reference", ar: "المرجع" },
  description: { en: "Description", ar: "الوصف" },
  debit: { en: "Debit", ar: "مدين" },
  credit: { en: "Credit", ar: "دائن" },
  balance: { en: "Balance", ar: "الرصيد" },
  opening: { en: "Opening", ar: "الافتتاحي" },
  closing: { en: "Closing", ar: "الختامي" },
  totalDebits: { en: "Total Debits", ar: "إجمالي المدين" },
  totalCredits: { en: "Total Credits", ar: "إجمالي الدائن" },
  closingBalance: { en: "Closing Balance", ar: "الرصيد الختامي" },
};

export function wantsDualDocumentLanguage(
  data?: Partial<Pick<RenderData, "company">> | null,
  opts?: Pick<RenderOptions, "documentLanguage" | "taxComplianceMode"> | null,
) {
  const country = data?.company?.country?.toUpperCase();
  return (
    opts?.documentLanguage === "dual" ||
    opts?.documentLanguage === "ar" ||
    opts?.taxComplianceMode === "ZATCA" ||
    country === "SA" ||
    country === "SAUDI ARABIA"
  );
}

export function docLabel(
  key: DocumentLabelKey,
  data?: Partial<Pick<RenderData, "company" | "document">> | null,
  opts?: Pick<RenderOptions, "documentLanguage" | "taxComplianceMode"> | null,
) {
  if (key === "invoice" && data?.document?.title) return data.document.title;
  const label = LABELS[key];
  if (!label) return key;
  if (key === "tax") {
    const country = data?.company?.country?.toUpperCase();
    if (
      opts?.taxComplianceMode === "ZATCA" ||
      country === "SA" ||
      country === "SAUDI ARABIA"
    ) {
      return wantsDualDocumentLanguage(data, opts) ? "VAT / ضريبة القيمة المضافة" : "VAT";
    }
  }
  if (!wantsDualDocumentLanguage(data, opts)) return label.en;
  return `${label.en} / ${label.ar}`;
}
