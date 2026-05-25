import * as XLSX from "xlsx";

export interface ExportColumn {
  key: string;
  label: string;
}

export function exportToCSV(data: Record<string, unknown>[], columns: ExportColumn[], filename: string) {
  const rows = data.map((item) => {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      row[col.label] = item[col.key] ?? "";
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // Auto-size columns
  const colWidths = columns.map((col) => ({
    wch: Math.max(col.label.length, 12),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `${filename}.csv`, {
    bookType: "csv",
    type: "binary",
  });
}

export function exportToExcel(data: Record<string, unknown>[], columns: ExportColumn[], filename: string) {
  const rows = data.map((item) => {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      row[col.label] = item[col.key] ?? "";
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

  const colWidths = columns.map((col) => ({
    wch: Math.max(col.label.length, 12),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
