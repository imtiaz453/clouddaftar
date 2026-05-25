"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/providers/toast-provider";
import type { ImportType, ImportResult } from "@/lib/import-utils";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
  title: string;
  description: string;
}

export function ImportDialog({ open, onOpenChange, type, title, description }: ImportDialogProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function downloadTemplate() {
    window.open(`/api/import/template/${type}`, "_blank");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);

      const res = await fetch("/api/import", { method: "POST", body: fd });
      const json = await res.json();

      if (json.success) {
        setResult(json.data);
        addToast({ title: `Imported ${json.data.success} ${type}`, variant: "success" });
        router.refresh();
      } else {
        addToast({ title: "Import failed", description: json.error, variant: "error" });
      }
    } catch {
      addToast({ title: "Import failed", variant: "error" });
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="mb-2 text-sm font-medium">Step 1: Download Template</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Start by downloading the standard template. Fill in your data following the column headers.
            </p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download {type} template
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="mb-2 text-sm font-medium">Step 2: Upload File</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Upload your completed Excel file (.xlsx or .csv)
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary"
            >
              {file ? (
                <>
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to select file or drag and drop
                  </span>
                  <span className="text-xs text-muted-foreground">
                    .xlsx or .csv supported
                  </span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {result && (
            <div className="rounded-lg border p-4">
              <p className="mb-2 text-sm font-medium">Import Results</p>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{result.success} imported</span>
                </div>
                {result.errors > 0 && (
                  <div className="flex items-center gap-1.5 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>{result.errors} failed</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{result.total} total</span>
                </div>
              </div>
              {result.errorDetails.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto rounded bg-red-50 p-2 text-xs text-red-700">
                  {result.errorDetails.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              {result ? "Done" : "Cancel"}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={!file || importing}>
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {importing ? "Importing..." : "Import"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
