"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/providers/toast-provider";
import {
  FileText,
  Palette,
  Printer,
  Plus,
  MoreHorizontal,
  Copy,
  Trash2,
  Star,
  Eye,
} from "lucide-react";
import {
  ADVANCED_SAMPLE_DATA,
  DEFAULT_ADVANCED_DESIGN,
  normalizeAdvancedDesign,
  renderAdvancedDocument,
} from "@/components/templates/advanced-template";

type TemplateUse = "invoice" | "quotation" | "thermal" | "purchase_order";

const PURCHASE_ORDER_DESIGN = {
  ...DEFAULT_ADVANCED_DESIGN,
  documentTitle: "Purchase Order",
  labels: {
    ...DEFAULT_ADVANCED_DESIGN.labels,
    orderBy: "Order By",
    orderTo: "Order To",
    poNumber: "PO #",
    orderDate: "Order Date",
    status: "Status",
    item: "Item #/Item description",
    sku: "HSN / SKU",
    qty: "Qty.",
    price: "Unit Price",
    tax: "VAT %",
    vatPerLine: "VAT per line",
    lineTotal: "Amount inclusive of VAT",
    subtotal: "Amount",
    summaryTotal: "Total amount inclusive of VAT",
    paid: "Paid Amount",
    due: "Total Due",
  },
  visibility: {
    ...DEFAULT_ADVANCED_DESIGN.visibility,
    supplierTaxId: true,
    paymentRecord: true,
    countryOfSupply: true,
    placeOfSupply: true,
    totalQuantity: true,
    paymentsTable: true,
    preparedBy: true,
  },
};

function normalizeTemplateUse(value: unknown): TemplateUse {
  return value === "quotation" ||
    value === "thermal" ||
    value === "purchase_order" ||
    value === "invoice"
    ? value
    : "invoice";
}

function templateUseLabel(value: TemplateUse) {
  if (value === "purchase_order") return "Purchase Order";
  if (value === "quotation") return "Quotation";
  if (value === "thermal") return "POS / Thermal";
  return "Invoice";
}

function normalizeEditorDesign(value: Record<string, any> | null | undefined, type: TemplateUse) {
  const base = type === "purchase_order" ? PURCHASE_ORDER_DESIGN : DEFAULT_ADVANCED_DESIGN;
  const normalized = normalizeAdvancedDesign({ ...base, ...(value || {}) });
  if (type === "purchase_order") {
    return {
      ...normalized,
      documentTitle: normalized.documentTitle || "Purchase Order",
      labels: { ...PURCHASE_ORDER_DESIGN.labels, ...normalized.labels },
      visibility: { ...PURCHASE_ORDER_DESIGN.visibility, ...normalized.visibility },
    };
  }
  return normalized;
}

function renderPurchaseOrderPreview(formData: any, design: any) {
  const primary = formData.primaryColor || "#2588f5";
  const accent = formData.accentColor || primary;
  const pale = `${accent}14`;
  const logoWidth = Number(design.layout.logoWidth || 280);
  const logoHeight = Number(design.layout.logoHeight || 120);
  const pad = Number(design.layout.sidePadding || 48);
  const topPad = Number(design.layout.topPadding || 38);
  const radius = Number(design.layout.borderRadius || 4);
  const lineTax = 1500;
  const lineTotal = 16500;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;color:#18212f;background:white;font-size:14px}
    .page{min-height:297mm}.hero{background:${pale};padding:${topPad}px ${pad}px;display:grid;grid-template-columns:1fr auto;align-items:start}
    h1{margin:0;color:${primary};font-weight:300;font-size:46px}.logo{width:${logoWidth}px;height:${logoHeight}px;display:flex;align-items:center;justify-content:flex-end;color:${primary};font-weight:800;font-size:28px}
    .content{padding:${pad}px}.grid{display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:42px;margin-bottom:34px}.label{display:inline-block;border-left:2px solid ${accent};background:${pale};color:#667085;padding:2px 8px;margin-bottom:8px}
    h2{font-size:18px;margin:0 0 8px}.muted{color:#667085;line-height:1.6}.kv{display:grid;grid-template-columns:90px 1fr;gap:7px 14px}.due{color:${primary};font-size:26px}
    table{width:100%;border-collapse:collapse}.items{border:1.5px solid ${accent};margin-bottom:32px;border-radius:${radius}px;overflow:hidden}.items th{background:${accent};color:white;text-align:left;padding:12px}.items td{padding:16px 12px;color:#40566f}.items tbody tr:nth-child(odd) td{background:${pale}}.right{text-align:right}.item{font-weight:700;color:#18212f}
    .lower{display:grid;grid-template-columns:1.2fr .75fr;gap:60px}.totals td{padding:10px 0}.totals td:last-child{text-align:right;font-weight:700}.grand td{border-top:1px solid #cbd5e1;padding-top:22px;font-size:20px}.grand td:last-child{color:${primary};font-size:28px}
    .footer{background:${pale};padding:36px ${pad}px 72px;display:grid;grid-template-columns:1fr 1fr;gap:70px}.footer h3{font-size:15px}
  </style></head><body><div class="page">
    <section class="hero"><h1>${design.documentTitle || "Purchase Order"}</h1><div class="logo">${formData.showLogo ? "LOGO" : ""}</div></section>
    <main class="content">
      <section class="grid">
        <div><span class="label">${design.labels.orderBy}</span><h2>Alabar Medical Company</h2><p class="muted">Abi Barkar Al Siddiq Branch Road, Riyadh, SA</p></div>
        <div><span class="label">${design.labels.orderTo}</span><h2>Sample Supplier</h2><p class="muted">Supplier address and tax details</p><div class="kv"><strong>${design.labels.poNumber}</strong><span>PO-00001</span><strong>${design.labels.orderDate}</strong><span>24 May 2026</span><strong>${design.labels.status}</strong><span>Pending</span></div></div>
        <div><span class="label">Payment Record</span><div class="kv"><strong>${design.labels.paid}</strong><span>SAR 0</span><strong>Due Amount</strong><strong class="due">SAR ${lineTotal.toLocaleString()}</strong></div></div>
      </section>
      <table class="items"><thead><tr><th>${design.labels.item}</th><th>${design.labels.sku}</th><th>${design.labels.qty}</th><th class="right">${design.labels.price}</th><th class="right">${design.labels.tax}</th><th class="right">${design.labels.vatPerLine}</th><th class="right">${design.labels.lineTotal}</th></tr></thead>
      <tbody><tr><td class="item">Medical Supplies</td><td>HSN-01</td><td>3</td><td class="right">SAR 5,000</td><td class="right">10%</td><td class="right">SAR ${lineTax.toLocaleString()}</td><td class="right"><strong>SAR ${lineTotal.toLocaleString()}</strong></td></tr></tbody></table>
      <section class="lower"><div><p class="muted">Country of supply: Saudi Arabia<br/>Place of supply: Riyadh<br/>Total quantity: 3</p></div>
      <table class="totals"><tr><td>${design.labels.subtotal}</td><td>SAR 15,000</td></tr><tr><td>Total VAT</td><td>SAR ${lineTax.toLocaleString()}</td></tr><tr><td>${design.labels.summaryTotal}</td><td>SAR ${lineTotal.toLocaleString()}</td></tr><tr class="grand"><td>${design.labels.due}</td><td>SAR ${lineTotal.toLocaleString()}</td></tr></table></section>
    </main><section class="footer"><div><h3>${design.labels.terms}</h3><p>${design.content.terms || "Please process this purchase order according to agreed supplier terms."}</p></div><div><h3>${design.labels.notes}</h3><p>${design.content.footerText || formData.footerText || "For any enquiries, contact our team."}</p></div></section>
  </div></body></html>`;
}

interface TemplatesClientProps {
  templates: any[];
  companySettings: {
    defaultInvoiceTemplate?: string | null;
    defaultThermalInvoiceTemplate?: string | null;
    defaultQuotationTemplate?: string | null;
    defaultPurchaseOrderTemplate?: string | null;
  } | null;
  canManage?: boolean;
}

export function TemplatesClient({
  templates,
  companySettings,
  canManage = true,
}: TemplatesClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    isDefault: false,
    defaultFor: "invoice" as TemplateUse,
    showLogo: true,
    showHeader: true,
    showFooter: true,
    showBarcode: false,
    showQR: true,
    showSignature: false,
    headerText: "",
    footerText: "",
    primaryColor: "#0f172a",
    accentColor: "#3b82f6",
    paperSize: "A4",
    fontSize: "normal",
    margin: "normal",
    advancedDesign: DEFAULT_ADVANCED_DESIGN,
  });

  function resetForm() {
    setFormData({
      name: "",
      isDefault: false,
      showLogo: true,
      showHeader: true,
      showFooter: true,
      defaultFor: "invoice",
      showBarcode: false,
      showQR: true,
      showSignature: false,
      headerText: "",
      footerText: "",
      primaryColor: "#0f172a",
      accentColor: "#3b82f6",
      paperSize: "A4",
      fontSize: "normal",
      margin: "normal",
      advancedDesign: DEFAULT_ADVANCED_DESIGN,
    });
  }

  function openEdit(tpl: any) {
    const templateType = tpl.templateType
      ? normalizeTemplateUse(tpl.templateType)
      : companySettings?.defaultQuotationTemplate === tpl.id
        ? "quotation"
        : companySettings?.defaultPurchaseOrderTemplate === tpl.id
          ? "purchase_order"
          : companySettings?.defaultThermalInvoiceTemplate === tpl.id
            ? "thermal"
            : "invoice";
    setFormData({
      name: tpl.name,
      isDefault: tpl.isDefault,
      showLogo: tpl.showLogo,
      defaultFor: templateType,
      showHeader: tpl.showHeader,
      showFooter: tpl.showFooter,
      showBarcode: tpl.showBarcode,
      showQR: tpl.showQR,
      showSignature: tpl.showSignature,
      headerText: tpl.headerText || "",
      footerText: tpl.footerText || "",
      primaryColor: tpl.primaryColor,
      accentColor: tpl.accentColor,
      paperSize: tpl.paperSize,
      fontSize: tpl.fontSize,
      margin: tpl.margin,
      advancedDesign: normalizeEditorDesign(tpl.advancedDesign, templateType),
    });
    setEditingTemplate(tpl);
    setCreateOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = { ...formData, type: formData.defaultFor };
      if (editingTemplate) {
        const res = await fetch(`/api/templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        addToast({ title: "Template updated", variant: "success" });
      } else {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        addToast({ title: "Template created", variant: "success" });
      }
      setCreateOpen(false);
      setEditingTemplate(null);
      resetForm();
      router.refresh();
    } catch {
      addToast({ title: "Error saving template", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast({ title: "Template deleted", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error deleting template", variant: "error" });
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/templates/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error();
      addToast({ title: "Template duplicated", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error duplicating template", variant: "error" });
    }
  }

  async function handleSetDefault(
    id: string,
    type: "invoice" | "quotation" | "thermal" | "purchase_order" = "invoice",
  ) {
    try {
      const res = await fetch(`/api/templates/${id}/default?type=${type}`, { method: "POST" });
      if (!res.ok) throw new Error();
      addToast({ title: `Default ${type} template updated`, variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error setting default", variant: "error" });
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""} configured
        </p>
        {mounted && canManage ? (
          <Dialog
            open={createOpen}
            onOpenChange={(v) => {
              if (!v) {
                setEditingTemplate(null);
                resetForm();
              }
              setCreateOpen(v);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Edit Template" : "New Template Maker"}
                </DialogTitle>
                <DialogDescription>
                  Control labels, header, footer, logo, item lines, signatures, sales person, notes,
                  terms, spacing, colors, and live preview.
                </DialogDescription>
              </DialogHeader>
              <AdvancedTemplateEditor formData={formData} setFormData={setFormData} />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateOpen(false);
                    setEditingTemplate(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !formData.name}>
                  {saving ? "Saving..." : editingTemplate ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : canManage ? (
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" /> New Template
          </Button>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground">Create your first invoice template</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl: any) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              isInvoiceDefault={companySettings?.defaultInvoiceTemplate === tpl.id}
              isThermalDefault={companySettings?.defaultThermalInvoiceTemplate === tpl.id}
              isQuotationDefault={companySettings?.defaultQuotationTemplate === tpl.id}
              isPurchaseOrderDefault={companySettings?.defaultPurchaseOrderTemplate === tpl.id}
              mounted={mounted}
              canManage={canManage}
              onEdit={() => openEdit(tpl)}
              onDelete={() => handleDelete(tpl.id)}
              onDuplicate={() => handleDuplicate(tpl.id)}
              onSetDefault={(type) => handleSetDefault(tpl.id, type)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdvancedTemplateEditor({
  formData,
  setFormData,
}: {
  formData: any;
  setFormData: (value: any) => void;
}) {
  const templateType = normalizeTemplateUse(formData.defaultFor);
  const design = normalizeEditorDesign(formData.advancedDesign, templateType);
  const sampleData = {
    ...ADVANCED_SAMPLE_DATA,
    type: formData.defaultFor === "quotation" ? "quotation" : "invoice",
  } as any;
  const renderOptions = {
    primaryColor: formData.primaryColor,
    accentColor: formData.accentColor,
    showLogo: formData.showLogo,
    showHeader: formData.showHeader,
    showFooter: formData.showFooter,
    showBarcode: formData.showBarcode,
    showQR: formData.showQR,
    showSignature: formData.showSignature,
    headerText: formData.headerText,
    footerText: formData.footerText,
    paperSize: formData.paperSize,
    fontSize: formData.fontSize,
    margin: formData.margin,
    currencySymbol: "SAR",
    taxName: "VAT",
  };
  const previewHtml =
    templateType === "purchase_order"
      ? renderPurchaseOrderPreview(formData, design)
      : renderAdvancedDocument(sampleData, renderOptions, design);

  function setField(key: string, value: any) {
    setFormData({ ...formData, [key]: value });
  }

  function setDesign(
    section: string,
    key: string,
    value: any,
    extraFields: Record<string, any> = {},
  ) {
    setFormData({
      ...formData,
      ...extraFields,
      advancedDesign: {
        ...design,
        [section]: {
          ...(design as any)[section],
          [key]: value,
        },
      },
    });
  }

  function setDocumentTitle(value: string) {
    setFormData({ ...formData, advancedDesign: { ...design, documentTitle: value } });
  }

  function setContentText(key: "headerText" | "footerText" | "notes" | "terms", value: string) {
    const extraFields = key === "headerText" || key === "footerText" ? { [key]: value } : {};
    setDesign("content", key, value, extraFields);
  }

  function setLabel(key: string, value: string) {
    setDesign("labels", key, value);
  }

  function setVisible(key: string, value: boolean) {
    setDesign("visibility", key, value);
  }

  const labelFields =
    templateType === "purchase_order"
      ? [
          ["orderBy", "Order By"],
          ["orderTo", "Order To"],
          ["poNumber", "PO number"],
          ["orderDate", "Order date"],
          ["status", "Status"],
          ["item", "Item description"],
          ["sku", "HSN / SKU"],
          ["qty", "Quantity"],
          ["price", "Unit Price"],
          ["tax", "VAT %"],
          ["vatPerLine", "VAT per line"],
          ["lineTotal", "Amount inclusive of VAT"],
          ["subtotal", "Amount"],
          ["summaryTotal", "Total amount inclusive of VAT"],
          ["paid", "Paid Amount"],
          ["due", "Total Due"],
          ["notes", "Additional Notes"],
          ["terms", "Terms and Conditions"],
        ]
      : [
          ["billTo", "Bill To"],
          ["preparedFor", "Prepared For"],
          ["number", "Number"],
          ["date", "Date"],
          ["dueDate", "Due Date"],
          ["salesPerson", "Sales Person"],
          ["payment", "Payment"],
          ["item", "Item"],
          ["sku", "SKU"],
          ["qty", "Qty"],
          ["unit", "Unit"],
          ["price", "Price"],
          ["discount", "Discount"],
          ["tax", "Tax"],
          ["lineTotal", "Line Total"],
          ["subtotal", "Subtotal"],
          ["paid", "Paid"],
          ["due", "Due"],
          ["summaryTotal", "Summary Total"],
          ["notes", "Notes"],
          ["terms", "Terms"],
          ["signature", "Signature"],
          ["customerSignature", "Customer Signature"],
        ];

  const visibilityFields =
    templateType === "purchase_order"
      ? [
          ["supplierTaxId", "Supplier tax ID"],
          ["paymentRecord", "Payment record"],
          ["countryOfSupply", "Country of supply"],
          ["placeOfSupply", "Place of supply"],
          ["totalQuantity", "Total quantity"],
          ["paymentsTable", "Payments table"],
          ["notes", "Additional notes"],
          ["terms", "Terms block"],
          ["preparedBy", "Prepared by"],
        ]
      : [
          ["companyAddress", "Company address"],
          ["customerPhone", "Customer phone"],
          ["customerEmail", "Customer email"],
          ["salesPerson", "Sales person / created by"],
          ["paymentMethod", "Payment method"],
          ["sku", "Item SKU"],
          ["unit", "Unit column"],
          ["discount", "Discount column"],
          ["tax", "Tax column"],
          ["notes", "Notes block"],
          ["terms", "Terms block"],
          ["signature", "Authorized signature"],
          ["customerSignature", "Customer signature"],
          ["pageNumbers", "Page numbers"],
          ["qrCode", "QR code block"],
        ];

  return (
    <div className="grid gap-4 py-2 lg:grid-cols-[420px_1fr]">
      <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-2">
        <Card className="p-3">
          <h3 className="mb-3 text-sm font-semibold">Template</h3>
          <div className="grid gap-3">
            <Control label="Template Name">
              <Input value={formData.name} onChange={(e) => setField("name", e.target.value)} />
            </Control>
            <div className="grid grid-cols-2 gap-3">
              <Control label="Template Type">
                <Select
                  value={formData.defaultFor}
                  onValueChange={(v) => {
                    const nextType = normalizeTemplateUse(v);
                    setFormData({
                      ...formData,
                      defaultFor: nextType,
                      paperSize:
                        nextType === "purchase_order"
                          ? "A4"
                          : nextType === "thermal"
                            ? formData.paperSize === "A4"
                              ? "THERMAL_80"
                              : formData.paperSize
                            : formData.paperSize,
                      advancedDesign: normalizeEditorDesign(formData.advancedDesign, nextType),
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="quotation">Quotation</SelectItem>
                    <SelectItem value="purchase_order">Purchase Order</SelectItem>
                    <SelectItem value="thermal">POS / Thermal</SelectItem>
                  </SelectContent>
                </Select>
              </Control>
              <Control label="Paper">
                <Select value={formData.paperSize} onValueChange={(v) => setField("paperSize", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="THERMAL_80">Thermal 80mm</SelectItem>
                    <SelectItem value="THERMAL_58">Thermal 58mm</SelectItem>
                  </SelectContent>
                </Select>
              </Control>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setField("isDefault", e.target.checked)}
              />
              Set as default {templateUseLabel(templateType)} template
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={formData.showLogo}
                  onChange={(e) => setField("showLogo", e.target.checked)}
                />
                Show logo
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={formData.showQR}
                  onChange={(e) => setField("showQR", e.target.checked)}
                />
                Show QR code
              </label>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-3 text-sm font-semibold">Brand, Header, Footer</h3>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <ColorControl
                label="Primary"
                value={formData.primaryColor}
                onChange={(v) => setField("primaryColor", v)}
              />
              <ColorControl
                label="Accent"
                value={formData.accentColor}
                onChange={(v) => setField("accentColor", v)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <Control label="Document Title">
                <Input
                  value={design.documentTitle ?? ""}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                />
              </Control>
              <AlignmentControl
                label="Title Align"
                value={design.text.titleAlign}
                onChange={(v) => setDesign("text", "titleAlign", v)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <Control label="Header Text">
                <textarea
                  value={design.content.headerText ?? ""}
                  onChange={(e) => setContentText("headerText", e.target.value)}
                  className="min-h-[78px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Optional header note shown under the document heading"
                />
              </Control>
              <AlignmentControl
                label="Header Align"
                value={design.text.headerTextAlign}
                onChange={(v) => setDesign("text", "headerTextAlign", v)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <Control label="Footer Text">
                <textarea
                  value={design.content.footerText ?? formData.footerText ?? ""}
                  onChange={(e) => setContentText("footerText", e.target.value)}
                  className="min-h-[86px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Type your own footer text here"
                />
              </Control>
              <AlignmentControl
                label="Footer Align"
                value={design.text.footerTextAlign}
                onChange={(v) => setDesign("text", "footerTextAlign", v)}
              />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-3 text-sm font-semibold">Logo and Spacing</h3>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <NumberControl
                label="Logo Width"
                value={design.layout.logoWidth}
                onChange={(v) => setDesign("layout", "logoWidth", v)}
              />
              <NumberControl
                label="Logo Height"
                value={design.layout.logoHeight}
                onChange={(v) => setDesign("layout", "logoHeight", v)}
              />
              <NumberControl
                label="Top Padding"
                value={design.layout.topPadding}
                onChange={(v) => setDesign("layout", "topPadding", v)}
              />
              <NumberControl
                label="Side Padding"
                value={design.layout.sidePadding}
                onChange={(v) => setDesign("layout", "sidePadding", v)}
              />
              <NumberControl
                label="Section Gap"
                value={design.layout.sectionGap}
                onChange={(v) => setDesign("layout", "sectionGap", v)}
              />
              <NumberControl
                label="Radius"
                value={design.layout.borderRadius}
                onChange={(v) => setDesign("layout", "borderRadius", v)}
              />
              <NumberControl
                label="QR Size"
                value={design.layout.qrSize}
                onChange={(v) => setDesign("layout", "qrSize", v)}
              />
            </div>
            <Control label="Logo Position">
              <Select
                value={design.layout.logoPosition ?? "left"}
                onValueChange={(v) => setDesign("layout", "logoPosition", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </Control>
            <Control label="QR Position">
              <Select
                value={design.layout.qrPosition ?? "bottom-right"}
                onValueChange={(v) => setDesign("layout", "qrPosition", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                </SelectContent>
              </Select>
            </Control>
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-3 text-sm font-semibold">Fields and Columns</h3>
          <div className="grid grid-cols-2 gap-2">
            {visibilityFields.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(design.visibility[key])}
                  onChange={(e) => setVisible(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-3 text-sm font-semibold">Item Lines</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["headerFill", "Filled header"],
              ["zebra", "Zebra rows"],
              ["verticalLines", "Vertical lines"],
              ["rowLines", "Row lines"],
              ["compact", "Compact lines"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(design.table[key])}
                  onChange={(e) => setDesign("table", key, e.target.checked)}
                />
                {label}
              </label>
            ))}
            <NumberControl
              label="Line Width"
              value={design.table.lineWidth}
              onChange={(v) => setDesign("table", "lineWidth", v)}
            />
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-3 text-sm font-semibold">Labels A-Z</h3>
          <div className="grid gap-2">
            {labelFields.map(([key, label]) => (
              <Control key={key} label={label}>
                <Input
                  value={design.labels[key] ?? ""}
                  onChange={(e) => setLabel(key, e.target.value)}
                />
              </Control>
            ))}
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-3 text-sm font-semibold">Notes, Terms and Signatures</h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <Control label="Note">
              <textarea
                value={design.content.notes ?? ""}
                onChange={(e) => setContentText("notes", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Control>
            <AlignmentControl
              label="Notes Align"
              value={design.text.notesAlign}
              onChange={(v) => setDesign("text", "notesAlign", v)}
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px]">
            <Control label="Terms and Conditions">
              <textarea
                value={design.content.terms ?? ""}
                onChange={(e) => setContentText("terms", e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Control>
            <AlignmentControl
              label="Terms Align"
              value={design.text.termsAlign}
              onChange={(v) => setDesign("text", "termsAlign", v)}
            />
          </div>
          <div className="mt-3">
            <AlignmentControl
              label="Signature Align"
              value={design.text.signatureAlign}
              onChange={(v) => setDesign("text", "signatureAlign", v)}
            />
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h3 className="text-sm font-semibold">Live Preview</h3>
          <Badge variant="secondary">Updates instantly</Badge>
        </div>
        <div className="h-[68vh] bg-muted p-3">
          <iframe
            title="Template live preview"
            srcDoc={previewHtml}
            className="h-full w-full rounded-md border bg-white"
          />
        </div>
      </Card>
    </div>
  );
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function AlignmentControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string | null;
  onChange: (value: "left" | "center" | "right") => void;
}) {
  return (
    <Control label={label}>
      <Select
        value={value === "left" || value === "center" || value === "right" ? value : "left"}
        onValueChange={(next) => onChange(next as "left" | "center" | "right")}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Center</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </Control>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined | null;
  onChange: (value: string) => void;
}) {
  return (
    <Control label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 rounded border"
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </Control>
  );
}

function NumberControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined | null;
  onChange: (value: number) => void;
}) {
  return (
    <Control label={label}>
      <Input
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </Control>
  );
}

function TemplateCard({
  template,
  isInvoiceDefault,
  isThermalDefault,
  isQuotationDefault,
  isPurchaseOrderDefault,
  mounted,
  canManage,
  onEdit,
  onDelete,
  onDuplicate,
  onSetDefault,
}: {
  template: any;
  isInvoiceDefault?: boolean;
  isThermalDefault?: boolean;
  isQuotationDefault?: boolean;
  isPurchaseOrderDefault?: boolean;
  mounted: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetDefault: (type: "invoice" | "quotation" | "thermal" | "purchase_order") => void;
}) {
  const color = template.primaryColor || "#0f172a";
  const templateType = normalizeTemplateUse(template.templateType);
  return (
    <Card className="overflow-hidden p-0">
      <div
        className="p-4"
        style={{
          background: `linear-gradient(135deg, ${color}, ${template.accentColor || color})`,
          minHeight: "120px",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="secondary" className="border-0 bg-white/20 text-[10px] text-white">
              {templateUseLabel(templateType)}
            </Badge>
            <Badge variant="secondary" className="ml-1 border-0 bg-white/20 text-[10px] text-white">
              {template.paperSize?.replace("THERMAL_", "") || "A4"}
            </Badge>
            {isInvoiceDefault && (
              <Badge className="ml-1 border-0 bg-yellow-500 text-[10px] text-white">
                Invoice Default
              </Badge>
            )}
            {isThermalDefault && (
              <Badge className="ml-1 border-0 bg-emerald-500 text-[10px] text-white">
                POS Default
              </Badge>
            )}
            {isQuotationDefault && (
              <Badge className="ml-1 border-0 bg-blue-500 text-[10px] text-white">
                Quotation Default
              </Badge>
            )}
            {isPurchaseOrderDefault && (
              <Badge className="ml-1 border-0 bg-purple-500 text-[10px] text-white">
                PO Default
              </Badge>
            )}
          </div>
          {mounted && canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/80 hover:bg-white/10 hover:text-white"
                  title="Template actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Palette className="mr-2 h-3.5 w-3.5" /> Customize
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
                {templateType === "invoice" && !isInvoiceDefault && (
                  <DropdownMenuItem onClick={() => onSetDefault("invoice")}>
                    <Star className="mr-2 h-3.5 w-3.5" /> Set as Invoice Default
                  </DropdownMenuItem>
                )}
                {templateType === "thermal" && !isThermalDefault && (
                  <DropdownMenuItem onClick={() => onSetDefault("thermal")}>
                    <Printer className="mr-2 h-3.5 w-3.5" /> Set as POS Default
                  </DropdownMenuItem>
                )}
                {templateType === "quotation" && !isQuotationDefault && (
                  <DropdownMenuItem onClick={() => onSetDefault("quotation")}>
                    <FileText className="mr-2 h-3.5 w-3.5" /> Set as Quotation Default
                  </DropdownMenuItem>
                )}
                {templateType === "purchase_order" && !isPurchaseOrderDefault && (
                  <DropdownMenuItem onClick={() => onSetDefault("purchase_order")}>
                    <FileText className="mr-2 h-3.5 w-3.5" /> Set as Purchase Order Default
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : canManage ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80"
              disabled
              title="Template actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="mt-6">
          <h3 className="font-semibold text-white">{template.name}</h3>
          <p className="mt-0.5 text-xs text-white/60">
            {template.fontSize} | {template.margin} margins
          </p>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          {template.showLogo && (
            <Badge variant="outline" className="h-5 text-[10px]">
              Logo
            </Badge>
          )}
          {template.showHeader && (
            <Badge variant="outline" className="h-5 text-[10px]">
              Header
            </Badge>
          )}
          {template.showFooter && (
            <Badge variant="outline" className="h-5 text-[10px]">
              Footer
            </Badge>
          )}
          {template.showBarcode && (
            <Badge variant="outline" className="h-5 text-[10px]">
              Barcode
            </Badge>
          )}
          {template.showSignature && (
            <Badge variant="outline" className="h-5 text-[10px]">
              Signature
            </Badge>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          {canManage && (
            <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={onEdit}>
              <Palette className="mr-1 h-3 w-3" /> Customize
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-[11px]"
            onClick={() =>
              window.open(`/api/invoices/template-preview?templateId=${template.id}`, "_blank")
            }
          >
            <Eye className="mr-1 h-3 w-3" /> Preview
          </Button>
        </div>
      </div>
    </Card>
  );
}
