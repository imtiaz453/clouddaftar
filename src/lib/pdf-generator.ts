import type { PaperSize, RenderData, RenderOptions, TemplateType } from "@/lib/template-registry";
import { docLabel } from "@/lib/document-labels";
import QRCode from "qrcode";

type PdfColor = [number, number, number];

interface PdfMeta {
  type: TemplateType;
  title?: string;
}

interface PdfPage {
  width: number;
  height: number;
  commands: string[];
}

const PAGE_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  THERMAL_80: { width: 226.77, height: 640 },
  THERMAL_58: { width: 164.41, height: 640 },
};

const COLOR_NAMES: Record<string, string> = {
  blue: "#2563eb",
  indigo: "#4f46e5",
  violet: "#7c3aed",
  green: "#16a34a",
  emerald: "#059669",
  teal: "#0d9488",
  cyan: "#0891b2",
  red: "#dc2626",
  orange: "#ea580c",
  amber: "#d97706",
  rose: "#e11d48",
  slate: "#1e293b",
  plum: "#7e22ce",
  zinc: "#27272a",
  neutral: "#262626",
  dark: "#111111",
};

function cleanText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfTextLiteral(value: unknown): string {
  const text = cleanText(value);
  if (/[^\x20-\x7E]/.test(text)) {
    const bytes = Buffer.from(`\ufeff${text}`, "utf16le");
    const be = Buffer.alloc(bytes.length);
    for (let i = 0; i < bytes.length; i += 2) {
      be[i] = bytes[i + 1];
      be[i + 1] = bytes[i];
    }
    return `<${be.toString("hex").toUpperCase()}>`;
  }
  return `(${text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

function hexToRgb(value: string | undefined, fallback: string): PdfColor {
  const color = value ? COLOR_NAMES[value] || value : fallback;
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  const hex = normalized.slice(1);
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function rgb(color: PdfColor) {
  return color.map((v) => Number(v.toFixed(3))).join(" ");
}

function approxTextWidth(text: string, size: number) {
  return cleanText(text).length * size * 0.52;
}

function wrapText(text: string, maxWidth: number, size: number): string[] {
  const words = cleanText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (approxTextWidth(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function formatMoney(amount: number, symbol: string) {
  return `${symbol} ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateForPdf(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

class PdfBuilder {
  pages: PdfPage[] = [];
  page: PdfPage;
  readonly primary: PdfColor;
  readonly accent: PdfColor;
  readonly muted: PdfColor = [0.39, 0.45, 0.55];
  readonly border: PdfColor = [0.88, 0.91, 0.95];

  constructor(
    readonly pageSize: PaperSize,
    primaryColor?: string,
    accentColor?: string,
  ) {
    const size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
    this.primary = hexToRgb(primaryColor, "#0f172a");
    this.accent = hexToRgb(accentColor, "#3b82f6");
    this.page = { ...size, commands: [] };
    this.pages.push(this.page);
  }

  addPage() {
    const size = PAGE_SIZES[this.pageSize] || PAGE_SIZES.A4;
    this.page = { ...size, commands: [] };
    this.pages.push(this.page);
  }

  text(
    text: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      bold?: boolean;
      color?: PdfColor;
      align?: "left" | "right" | "center";
    } = {},
  ) {
    const size = opts.size || 10;
    const safeText = cleanText(text);
    const width = approxTextWidth(safeText, size);
    const tx = opts.align === "right" ? x - width : opts.align === "center" ? x - width / 2 : x;
    const font = opts.bold ? "F2" : "F1";
    const color = rgb(opts.color || [0.12, 0.16, 0.22]);
    this.page.commands.push(
      `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${tx.toFixed(2)} ${y.toFixed(2)} Tm ${pdfTextLiteral(safeText)} Tj ET`,
    );
  }

  wrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    opts: { size?: number; bold?: boolean; color?: PdfColor; lineHeight?: number } = {},
  ) {
    const size = opts.size || 10;
    const lineHeight = opts.lineHeight || size + 4;
    const lines = wrapText(text, maxWidth, size);
    lines.forEach((line, index) => {
      this.text(line, x, y - index * lineHeight, opts);
    });
    return lines.length * lineHeight;
  }

  line(x1: number, y1: number, x2: number, y2: number, color: PdfColor = this.border, width = 1) {
    this.page.commands.push(
      `q ${width} w ${rgb(color)} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`,
    );
  }

  rect(x: number, y: number, width: number, height: number, color: PdfColor, stroke = false) {
    const op = stroke ? `${rgb(color)} RG` : `${rgb(color)} rg`;
    this.page.commands.push(
      `q ${op} ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${stroke ? "S" : "f"} Q`,
    );
  }

  qr(payload: string, x: number, y: number, size: number) {
    const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
    const moduleCount = qr.modules.size;
    const moduleSize = size / moduleCount;

    this.rect(x - 4, y - 4, size + 8, size + 8, [1, 1, 1]);
    this.rect(x - 4, y - 4, size + 8, size + 8, this.border, true);

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (!qr.modules.get(row, col)) continue;
        this.rect(
          x + col * moduleSize,
          y + size - (row + 1) * moduleSize,
          moduleSize + 0.02,
          moduleSize + 0.02,
          [0, 0, 0],
        );
      }
    }
  }
}

function buildPdfBytes(pages: PdfPage[], title: string): Uint8Array {
  const objects: string[] = [];
  const fontRegularObject = 3;
  const fontBoldObject = 4;
  const pageRefs: number[] = [];

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let objectNumber = 5;
  for (const page of pages) {
    const pageObject = objectNumber++;
    const contentObject = objectNumber++;
    pageRefs.push(pageObject);
    const content = `${page.commands.join("\n")}\n`;
    objects[pageObject - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] /Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject - 1] =
      `<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}endstream`;
  }

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pages.length} >>`;

  const infoObject = objectNumber++;
  objects[infoObject - 1] =
    `<< /Title ${pdfTextLiteral(title)} /Creator (Cloud Daftar) /Producer (Cloud Daftar) >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "binary");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Buffer.from(pdf, "binary"));
}

function drawA4Document(data: RenderData, opts: RenderOptions, meta: PdfMeta) {
  const pdf = new PdfBuilder("A4", opts.primaryColor, opts.accentColor);
  const margin = 42;
  const width = pdf.page.width;
  const height = pdf.page.height;
  const contentWidth = width - margin * 2;
  const typeLabel = docLabel(meta.type === "quotation" ? "quotation" : "invoice", data, opts).toUpperCase();
  const currency = opts.currencySymbol || "PKR";
  let y = height - margin;

  function drawHeader() {
    pdf.rect(0, height - 96, width, 96, [0.985, 0.99, 1]);
    pdf.rect(0, height - 16, width, 16, pdf.primary);
    pdf.rect(0, height - 22, width * 0.42, 6, pdf.accent);
    pdf.rect(width - 212, height - 96, 212, 96, pdf.primary);
    pdf.text(data.company.name || "Business", margin, y, {
      size: 19,
      bold: true,
      color: pdf.primary,
    });
    y -= 18;

    const companyLines = [
      data.company.address,
      [data.company.city, data.company.state, data.company.zipCode].filter(Boolean).join(", "),
      data.company.country,
      [data.company.phone, data.company.email].filter(Boolean).join(" | "),
      data.company.taxId ? `${opts.taxName || "Tax"}: ${data.company.taxId}` : "",
      data.company.website,
    ].filter(Boolean);

    for (const line of companyLines.slice(0, 4)) {
      pdf.text(String(line), margin, y, { size: 9, color: pdf.muted });
      y -= 12;
    }

    const rightX = width - margin;
    pdf.text(typeLabel, rightX, height - margin - 2, {
      size: 22,
      bold: true,
      color: [1, 1, 1],
      align: "right",
    });
    pdf.text(data.document.number, rightX, height - margin - 25, {
      size: 11,
      bold: true,
      color: [1, 1, 1],
      align: "right",
    });
    pdf.text(formatDateForPdf(data.document.date), rightX, height - margin - 40, {
      size: 9,
      color: [0.84, 0.88, 0.94],
      align: "right",
    });
    pdf.text(data.document.status.replace(/_/g, " "), rightX, height - margin - 55, {
      size: 9,
      color: pdf.accent,
      bold: true,
      align: "right",
    });

    y = Math.min(y - 16, height - margin - 92);
    pdf.line(margin, y, width - margin, y);
    y -= 24;
  }

  function drawParties() {
    const boxWidth = (contentWidth - 18) / 2;
    const boxTop = y;
    const boxHeight = 92;
    pdf.rect(margin, boxTop - boxHeight, boxWidth, boxHeight, [0.98, 0.99, 1]);
    pdf.rect(margin + boxWidth + 18, boxTop - boxHeight, boxWidth, boxHeight, [0.98, 0.99, 1]);
    pdf.rect(margin, boxTop - boxHeight, 4, boxHeight, pdf.accent);
    pdf.rect(margin + boxWidth + 18, boxTop - boxHeight, 4, boxHeight, pdf.accent);
    pdf.rect(margin, boxTop - boxHeight, boxWidth, boxHeight, pdf.border, true);
    pdf.rect(margin + boxWidth + 18, boxTop - boxHeight, boxWidth, boxHeight, pdf.border, true);

    pdf.text(docLabel(meta.type === "quotation" ? "preparedFor" : "billTo", data, opts).toUpperCase(), margin + 12, boxTop - 18, {
      size: 8,
      bold: true,
      color: pdf.muted,
    });
    pdf.text(data.customer?.name || docLabel("walkInCustomer", data, opts), margin + 12, boxTop - 36, {
      size: 11,
      bold: true,
    });
    if (data.customer?.phone)
      pdf.text(data.customer.phone, margin + 12, boxTop - 52, { size: 9, color: pdf.muted });
    if (data.customer?.email)
      pdf.text(data.customer.email, margin + 12, boxTop - 66, { size: 9, color: pdf.muted });
    if (data.customer?.address) {
      pdf.wrappedText(data.customer.address, margin + 12, boxTop - 80, boxWidth - 24, {
        size: 8,
        color: pdf.muted,
        lineHeight: 10,
      });
    }

    const detailsX = margin + boxWidth + 30;
    pdf.text(
      docLabel(meta.type === "quotation" ? "quoteDetails" : "paymentDetails", data, opts).toUpperCase(),
      detailsX,
      boxTop - 18,
      {
        size: 8,
        bold: true,
        color: pdf.muted,
      },
    );
    const detailLines = [
      [docLabel("number", data, opts), data.document.number],
      [docLabel("date", data, opts), formatDateForPdf(data.document.date)],
      [
        docLabel(meta.type === "quotation" ? "validUntil" : "dueDate", data, opts),
        formatDateForPdf(data.document.dueDate),
      ],
      [docLabel("payment", data, opts), data.document.paymentMethod?.replace(/_/g, " ") || "N/A"],
      [docLabel("preparedBy", data, opts), data.document.createdByName || ""],
    ].filter(([, value]) => Boolean(value));

    detailLines.slice(0, 4).forEach(([label, value], index) => {
      const rowY = boxTop - 38 - index * 14;
      pdf.text(label, detailsX, rowY, { size: 8, color: pdf.muted });
      pdf.text(value, margin + boxWidth * 2 + 18, rowY, { size: 8.5, align: "right" });
    });

    y = boxTop - boxHeight - 26;
  }

  function drawTableHeader() {
    const qtyX = margin + 285;
    const priceX = margin + 370;
    const taxX = margin + 430;
    const totalX = width - margin - 8;

    pdf.rect(margin, y - 20, contentWidth, 20, pdf.primary);
    pdf.text(docLabel("item", data, opts), margin + 8, y - 14, { size: 8, bold: true, color: [1, 1, 1] });
    pdf.text(docLabel("qty", data, opts), qtyX, y - 14, {
      size: 8,
      bold: true,
      color: [1, 1, 1],
      align: "right",
    });
    pdf.text(docLabel("price", data, opts), priceX, y - 14, {
      size: 8,
      bold: true,
      color: [1, 1, 1],
      align: "right",
    });
    pdf.text(docLabel("tax", data, opts), taxX, y - 14, {
      size: 8,
      bold: true,
      color: [1, 1, 1],
      align: "right",
    });
    pdf.text(docLabel("total", data, opts), totalX, y - 14, {
      size: 8,
      bold: true,
      color: [1, 1, 1],
      align: "right",
    });
    y -= 28;
  }

  function ensureSpace(requiredHeight: number) {
    if (y - requiredHeight > margin + 120) return;
    pdf.addPage();
    y = height - margin;
    pdf.text(`${typeLabel} ${data.document.number}`, margin, y, {
      size: 12,
      bold: true,
      color: pdf.primary,
    });
    y -= 26;
    drawTableHeader();
  }

  drawHeader();
  drawParties();
  drawTableHeader();

  data.items.forEach((item, index) => {
    const qtyX = margin + 285;
    const priceX = margin + 370;
    const taxX = margin + 430;
    const totalX = width - margin - 8;
    const nameLines = wrapText(item.name, 218, 9);
    const rowHeight = Math.max(24, nameLines.length * 11 + (item.sku ? 11 : 0) + 8);
    ensureSpace(rowHeight);

    if (index % 2 === 1) {
      pdf.rect(margin, y - rowHeight + 6, contentWidth, rowHeight, [0.98, 0.99, 1]);
    }
    nameLines.forEach((line, lineIndex) => {
      pdf.text(line, margin + 8, y - 4 - lineIndex * 11, { size: 9, bold: lineIndex === 0 });
    });
    if (item.sku) {
      pdf.text(`SKU: ${item.sku}`, margin + 8, y - 4 - nameLines.length * 11, {
        size: 7.5,
        color: pdf.muted,
      });
    }
    pdf.text(String(item.quantity), qtyX, y - 4, { size: 8.5, align: "right" });
    pdf.text(formatMoney(item.price, currency), priceX, y - 4, { size: 8.5, align: "right" });
    pdf.text(`${item.tax || 0}%`, taxX, y - 4, { size: 8.5, align: "right" });
    pdf.text(formatMoney(item.subtotal, currency), totalX, y - 4, {
      size: 8.5,
      bold: true,
      align: "right",
    });
    y -= rowHeight;
    pdf.line(margin, y + 6, width - margin, y + 6);
  });

  ensureSpace(115);
  const summaryX = width - margin - 220;
  y -= 8;
  const totals = [
    [docLabel("subtotal", data, opts), data.document.subtotal],
    [docLabel("discount", data, opts), -data.document.discount],
    [opts.taxName || "Tax", data.document.tax],
    [docLabel("total", data, opts), data.document.total],
  ];
  if (meta.type === "invoice") {
    totals.push([docLabel("paid", data, opts), data.document.paid], [docLabel("due", data, opts), data.document.due]);
  }

  pdf.rect(summaryX - 12, y - totals.length * 17 - 8, 232, totals.length * 17 + 24, [0.98, 0.99, 1]);
  pdf.rect(summaryX - 12, y - totals.length * 17 - 8, 232, totals.length * 17 + 24, pdf.border, true);

  totals.forEach(([label, amount], index) => {
    const isTotal = String(label).startsWith(docLabel("total", data, opts));
    const rowY = y - index * 17;
    if (isTotal) pdf.line(summaryX, rowY + 10, width - margin, rowY + 10, pdf.primary, 1.2);
    pdf.text(String(label), summaryX, rowY, { size: isTotal ? 11 : 9, bold: isTotal });
    pdf.text(formatMoney(Number(amount), currency), width - margin, rowY, {
      size: isTotal ? 11 : 9,
      bold: isTotal,
      align: "right",
      color: String(label).startsWith(docLabel("due", data, opts)) && Number(amount) > 0 ? [0.86, 0.15, 0.15] : [0.12, 0.16, 0.22],
    });
  });
  y -= totals.length * 17 + 20;

  const qrPayload = opts.showQR ? data.taxInfo?.qrPayload : null;
  if (qrPayload) {
    const qrSize = 78;
    const qrX = margin + 10;
    ensureSpace(qrSize + 40);
    const qrY = y - qrSize;
    pdf.qr(qrPayload, qrX, qrY, qrSize);
    const mode = opts.taxComplianceMode || data.document.taxComplianceMode || "NONE";
    const label = mode === "FBR" ? "FBR Invoice QR" : mode === "ZATCA" ? "ZATCA QR" : "Invoice QR";
    pdf.text(label, qrX + qrSize / 2, qrY - 13, {
      size: 8,
      bold: true,
      color: pdf.muted,
      align: "center",
    });
    if (opts.taxComplianceStatus) {
      pdf.text(opts.taxComplianceStatus.replace(/_/g, " "), qrX + qrSize / 2, qrY - 25, {
        size: 7,
        color: pdf.muted,
        align: "center",
      });
    }
    y -= qrSize + 38;
  }

  if (data.document.notes || data.document.terms || opts.footerText) {
    const noteText = data.document.notes || data.document.terms || opts.footerText || "";
    ensureSpace(60);
    pdf.text(data.document.notes ? docLabel("notes", data, opts) : docLabel("terms", data, opts), margin, y, {
      size: 8,
      bold: true,
      color: pdf.muted,
    });
    y -= 14;
    y -= pdf.wrappedText(noteText, margin, y, contentWidth, {
      size: 9,
      color: [0.28, 0.33, 0.4],
      lineHeight: 12,
    });
  }

  if (opts.showSignature) {
    ensureSpace(60);
    y -= 20;
    pdf.line(margin, y, margin + 170, y, pdf.muted);
    pdf.line(width - margin - 170, y, width - margin, y, pdf.muted);
    pdf.text(docLabel("authorizedSignature", data, opts), margin + 85, y - 14, {
      size: 8,
      color: pdf.muted,
      align: "center",
    });
    pdf.text(docLabel("customerSignature", data, opts), width - margin - 85, y - 14, {
      size: 8,
      color: pdf.muted,
      align: "center",
    });
  }

  const footer =
    opts.footerText ||
    (meta.type === "quotation"
      ? "Thank you for the opportunity to quote."
      : "Thank you for your business.");
  pdf.pages.forEach((page, index) => {
    const previous = pdf.page;
    pdf.page = page;
    pdf.line(margin, 34, page.width - margin, 34);
    pdf.text(footer, margin, 20, { size: 8, color: pdf.muted });
    pdf.text(`Page ${index + 1} of ${pdf.pages.length}`, page.width - margin, 20, {
      size: 8,
      color: pdf.muted,
      align: "right",
    });
    pdf.page = previous;
  });

  return buildPdfBytes(pdf.pages, meta.title || `${typeLabel} ${data.document.number}`);
}

function drawThermalDocument(data: RenderData, opts: RenderOptions, meta: PdfMeta) {
  const pageSize = opts.paperSize === "THERMAL_58" ? "THERMAL_58" : "THERMAL_80";
  const itemHeight = 34;
  const hasQr = Boolean(opts.showQR && data.taxInfo?.qrPayload);
  const pageHeight = Math.max(420, 260 + data.items.length * itemHeight + (hasQr ? 105 : 0));
  const pdf = new PdfBuilder(pageSize, "#111111", "#111111");
  pdf.page.height = pageHeight;
  const width = pdf.page.width;
  const margin = pageSize === "THERMAL_58" ? 10 : 14;
  let y = pageHeight - margin;
  const currency = opts.currencySymbol || "PKR";

  pdf.text(data.company.name || "Business", width / 2, y, {
    size: 11,
    bold: true,
    align: "center",
  });
  y -= 13;
  for (const line of [data.company.phone, data.company.email, data.company.taxId]
    .filter(Boolean)
    .slice(0, 3)) {
    pdf.text(String(line), width / 2, y, { size: 7, color: pdf.muted, align: "center" });
    y -= 9;
  }
  pdf.line(margin, y, width - margin, y, pdf.muted);
  y -= 14;
  pdf.text(docLabel(meta.type === "quotation" ? "quotation" : "invoice", data, opts).toUpperCase(), width / 2, y, {
    size: 9,
    bold: true,
    align: "center",
  });
  y -= 13;
  pdf.text(data.document.number, margin, y, { size: 7 });
  pdf.text(formatDateForPdf(data.document.date), width - margin, y, { size: 7, align: "right" });
  y -= 12;
  if (data.customer?.name) {
    pdf.text(`${docLabel("customer", data, opts)}: ${data.customer.name}`, margin, y, { size: 7 });
    y -= 10;
  }
  pdf.line(margin, y, width - margin, y, pdf.muted);
  y -= 12;

  data.items.forEach((item) => {
    const nameLines = wrapText(item.name, width - margin * 2, 7);
    nameLines.slice(0, 2).forEach((line) => {
      pdf.text(line, margin, y, { size: 7, bold: true });
      y -= 9;
    });
    pdf.text(`${item.quantity} x ${formatMoney(item.price, currency)}`, margin, y, { size: 7 });
    pdf.text(formatMoney(item.subtotal, currency), width - margin, y, {
      size: 7,
      bold: true,
      align: "right",
    });
    y -= 12;
  });

  pdf.line(margin, y, width - margin, y, pdf.muted);
  y -= 13;
  const totals = [
    [docLabel("subtotal", data, opts), data.document.subtotal],
    [docLabel("discount", data, opts), -data.document.discount],
    [opts.taxName || "Tax", data.document.tax],
    [docLabel("total", data, opts), data.document.total],
  ];
  if (meta.type === "invoice" && data.document.due > 0) totals.push([docLabel("due", data, opts), data.document.due]);

  totals.forEach(([label, amount]) => {
    pdf.text(String(label), margin, y, {
      size: String(label).startsWith(docLabel("total", data, opts)) ? 8 : 7,
      bold: String(label).startsWith(docLabel("total", data, opts)),
    });
    pdf.text(formatMoney(Number(amount), currency), width - margin, y, {
      size: String(label).startsWith(docLabel("total", data, opts)) ? 8 : 7,
      bold: String(label).startsWith(docLabel("total", data, opts)),
      align: "right",
    });
    y -= 10;
  });

  const qrPayload = opts.showQR ? data.taxInfo?.qrPayload : null;
  if (qrPayload) {
    const qrSize = Math.min(70, width - margin * 2 - 8);
    y -= qrSize + 8;
    pdf.qr(qrPayload, (width - qrSize) / 2, y, qrSize);
    y -= 12;
    const mode = opts.taxComplianceMode || data.document.taxComplianceMode || "NONE";
    pdf.text(mode === "FBR" ? "FBR Invoice QR" : mode === "ZATCA" ? "ZATCA QR" : "Invoice QR", width / 2, y, {
      size: 7,
      color: pdf.muted,
      align: "center",
    });
  }

  y -= 8;
  pdf.text(opts.footerText || "Thank you!", width / 2, y, {
    size: 7,
    color: pdf.muted,
    align: "center",
  });

  return buildPdfBytes(pdf.pages, meta.title || data.document.number);
}

export function generateDocumentPdf(
  data: RenderData,
  opts: RenderOptions,
  meta: PdfMeta,
): Uint8Array {
  if (opts.paperSize === "THERMAL_58" || opts.paperSize === "THERMAL_80") {
    return drawThermalDocument(data, opts, meta);
  }
  return drawA4Document(data, opts, meta);
}

export interface StatementPdfTransaction {
  date: Date | string;
  reference?: string;
  description?: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface StatementPdfData {
  title: string;
  partyLabel: string;
  partyName: string;
  partyPhone?: string | null;
  fromDate?: Date | string;
  toDate?: Date | string;
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  currencySymbol?: string;
  documentLanguage?: string | null;
  country?: string | null;
  transactions: StatementPdfTransaction[];
}

export function generateStatementPdf(data: StatementPdfData): Uint8Array {
  const pdf = new PdfBuilder("A4", "#0f172a", "#2563eb");
  const margin = 42;
  const width = pdf.page.width;
  const height = pdf.page.height;
  const contentWidth = width - margin * 2;
  const currency = data.currencySymbol || "Rs";
  const labelContext = { company: { name: "Cloud Daftar", country: data.country || null } };
  const labelOptions = { documentLanguage: data.documentLanguage || undefined };
  const sLabel = (key: Parameters<typeof docLabel>[0]) => docLabel(key, labelContext, labelOptions);
  let y = height - margin;

  const drawTableHeader = () => {
    pdf.rect(margin, y - 18, contentWidth, 18, pdf.primary);
    pdf.text(sLabel("date"), margin + 8, y - 12, { size: 8, bold: true, color: [1, 1, 1] });
    pdf.text(sLabel("reference"), margin + 76, y - 12, { size: 8, bold: true, color: [1, 1, 1] });
    pdf.text(sLabel("description"), margin + 160, y - 12, { size: 8, bold: true, color: [1, 1, 1] });
    pdf.text(sLabel("debit"), margin + 370, y - 12, { size: 8, bold: true, align: "right", color: [1, 1, 1] });
    pdf.text(sLabel("credit"), margin + 440, y - 12, { size: 8, bold: true, align: "right", color: [1, 1, 1] });
    pdf.text(sLabel("balance"), width - margin - 8, y - 12, {
      size: 8,
      bold: true,
      align: "right",
      color: [1, 1, 1],
    });
    y -= 22;
  };

  pdf.rect(0, height - 92, width, 92, [0.985, 0.99, 1]);
  pdf.rect(0, height - 14, width, 14, pdf.primary);
  pdf.rect(0, height - 20, width * 0.35, 6, pdf.accent);
  pdf.text("Cloud Daftar", margin, y, { size: 16, bold: true, color: pdf.primary });
  pdf.text(data.title, width - margin, y, {
    size: 18,
    bold: true,
    align: "right",
    color: pdf.primary,
  });
  y -= 22;
  pdf.text(
    `${formatDateForPdf(data.fromDate) || "Beginning"} to ${formatDateForPdf(data.toDate) || "Today"}`,
    width - margin,
    y,
    { size: 9, align: "right", color: pdf.muted },
  );
  y -= 34;

  pdf.rect(margin, y - 62, contentWidth, 62, [0.98, 0.99, 1]);
  pdf.rect(margin, y - 62, 4, 62, pdf.accent);
  pdf.rect(margin, y - 62, contentWidth, 62, pdf.border, true);
  pdf.text(data.partyLabel.toUpperCase(), margin + 12, y - 16, {
    size: 8,
    bold: true,
    color: pdf.muted,
  });
  pdf.text(data.partyName, margin + 12, y - 34, { size: 12, bold: true });
  if (data.partyPhone) pdf.text(data.partyPhone, margin + 12, y - 50, { size: 9, color: pdf.muted });
  pdf.text(sLabel("opening"), margin + 330, y - 16, { size: 8, color: pdf.muted });
  pdf.text(formatMoney(data.openingBalance, currency), width - margin - 12, y - 16, {
    size: 9,
    align: "right",
  });
  pdf.text(sLabel("closing"), margin + 330, y - 34, { size: 8, color: pdf.muted });
  pdf.text(formatMoney(data.closingBalance, currency), width - margin - 12, y - 34, {
    size: 11,
    bold: true,
    align: "right",
    color: data.closingBalance > 0 ? [0.86, 0.15, 0.15] : pdf.primary,
  });
  y -= 84;

  drawTableHeader();

  const rows = data.transactions.length
    ? data.transactions
    : [{
        date: new Date(),
        reference: "-",
        description: "No transactions in this period",
        debit: 0,
        credit: 0,
        balance: data.openingBalance,
      }];

  rows.forEach((row, index) => {
    if (y < 86) {
      pdf.addPage();
      y = height - margin;
      pdf.text(data.title, margin, y, { size: 12, bold: true, color: pdf.primary });
      y -= 28;
      drawTableHeader();
    }
    if (index % 2 === 0) pdf.rect(margin, y - 18, contentWidth, 20, [0.985, 0.99, 1]);
    pdf.text(formatDateForPdf(row.date), margin + 8, y - 10, { size: 8 });
    pdf.text(row.reference || "-", margin + 76, y - 10, { size: 8 });
    pdf.text(row.description || "-", margin + 160, y - 10, { size: 8 });
    pdf.text(row.debit > 0 ? formatMoney(row.debit, currency) : "-", margin + 370, y - 10, {
      size: 8,
      align: "right",
    });
    pdf.text(row.credit > 0 ? formatMoney(row.credit, currency) : "-", margin + 440, y - 10, {
      size: 8,
      align: "right",
    });
    pdf.text(formatMoney(row.balance, currency), width - margin - 8, y - 10, {
      size: 8,
      align: "right",
    });
    y -= 20;
  });

  y -= 14;
  const summaryX = width - margin - 220;
  pdf.rect(summaryX - 12, y - 70, 232, 84, [0.98, 0.99, 1]);
  pdf.rect(summaryX - 12, y - 70, 232, 84, pdf.border, true);
  [
    [sLabel("totalDebits"), data.totalDebits],
    [sLabel("totalCredits"), data.totalCredits],
    [sLabel("closingBalance"), data.closingBalance],
  ].forEach(([label, amount], index) => {
    const rowY = y - index * 20;
    const isTotal = index === 2;
    if (isTotal) pdf.line(summaryX, rowY + 9, width - margin, rowY + 9, pdf.primary, 1.2);
    pdf.text(String(label), summaryX, rowY, { size: isTotal ? 10 : 9, bold: isTotal });
    pdf.text(formatMoney(Number(amount), currency), width - margin, rowY, {
      size: isTotal ? 10 : 9,
      bold: isTotal,
      align: "right",
    });
  });

  pdf.pages.forEach((page, index) => {
    const previous = pdf.page;
    pdf.page = page;
    pdf.line(margin, 34, page.width - margin, 34);
    pdf.text("Generated by Cloud Daftar", margin, 20, { size: 8, color: pdf.muted });
    pdf.text(`Page ${index + 1} of ${pdf.pages.length}`, page.width - margin, 20, {
      size: 8,
      align: "right",
      color: pdf.muted,
    });
    pdf.page = previous;
  });

  return buildPdfBytes(pdf.pages, data.title);
}

export function pdfFilename(prefix: string, number: string) {
  const safe = cleanText(number).replace(/[^a-z0-9_-]+/gi, "-") || "document";
  return `${prefix}-${safe}.pdf`;
}
