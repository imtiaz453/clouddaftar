"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TEMPLATE_DEFINITIONS, getTemplatesByType, type TemplateDefinition, type TemplateType, type PaperSize } from "@/lib/template-registry";
import { Printer, Download, FileText, Eye } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TemplateType;
  documentId: string;
  onPrint?: (templateId: string) => void;
  onDownload?: (templateId: string) => void;
  defaultTab?: PaperSize;
}

export function TemplateSelector({ open, onOpenChange, type, documentId, onPrint, onDownload, defaultTab }: TemplateSelectorProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>(defaultTab || "A4");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const templates = type === "invoice"
    ? getTemplatesByType("invoice", paperSize)
    : getTemplatesByType("quotation");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {type === "invoice" ? "Print / Download Invoice" : "Print / Download Quotation"}
          </DialogTitle>
          <DialogDescription>
            Choose a template for your document
          </DialogDescription>
        </DialogHeader>

        {type === "invoice" && (
          <Tabs value={paperSize} onValueChange={(v) => { setPaperSize(v as PaperSize); setSelectedTemplate(null); }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="A4">A4 Templates</TabsTrigger>
              <TabsTrigger value="THERMAL_80">Thermal 80mm</TabsTrigger>
              <TabsTrigger value="THERMAL_58">Thermal 58mm</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4">
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                selected={selectedTemplate === tpl.id}
                onSelect={() => setSelectedTemplate(tpl.id)}
                onPrint={() => onPrint?.(tpl.id)}
                onDownload={() => onDownload?.(tpl.id)}
                documentType={type}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!selectedTemplate}
            onClick={() => {
              if (selectedTemplate) {
                onPrint?.(selectedTemplate);
                onOpenChange(false);
              }
            }}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            disabled={!selectedTemplate}
            variant="secondary"
            onClick={() => {
              if (selectedTemplate) {
                onDownload?.(selectedTemplate);
                onOpenChange(false);
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, selected, onSelect, onPrint, onDownload, documentType }: {
  template: TemplateDefinition;
  selected: boolean;
  onSelect: () => void;
  onPrint: () => void;
  onDownload: () => void;
  documentType: TemplateType;
}) {
  const label = documentType === "invoice" ? "Invoice" : "Quotation";
  return (
    <Card
      className={`p-0 overflow-hidden cursor-pointer transition-all hover:shadow-md ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={onSelect}
    >
      <div className="p-3" style={{ background: `linear-gradient(135deg, ${template.previewColor}, ${template.previewAccent})`, minHeight: "100px" }}>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="bg-white/20 text-white border-0">{label}</Badge>
          {template.paperSize !== "A4" && <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px]">{template.paperSize.replace("THERMAL_", "")}mm</Badge>}
        </div>
        <h3 className="text-white font-semibold text-sm mt-6">{template.name}</h3>
        <p className="text-white/70 text-[10px] mt-1 line-clamp-2">{template.description}</p>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[11px] text-muted-foreground line-clamp-1">{template.style.replace("-", " ")} style</p>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onPrint}>
            <Printer className="mr-1 h-3 w-3" /> Print
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onDownload}>
            <Download className="mr-1 h-3 w-3" /> PDF
          </Button>
        </div>
      </div>
    </Card>
  );
}
