"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeftRight,
  Barcode,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Layers3,
  MapPin,
  PackageCheck,
  PackageSearch,
  Printer,
  Save,
  Search,
  Truck,
} from "lucide-react";
import { updateProduct } from "@/actions/inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/utils";
import { exportToCSV } from "@/lib/export-utils";
import { useToast } from "@/providers/toast-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  stock: number;
  minStock: number;
  unit?: string | null;
  sellingPrice?: unknown;
  isActive?: boolean;
};

type WarehouseLocation = {
  id: string;
  name: string;
  code: string;
  type: string;
  barcode?: string | null;
  warehouse: {
    name: string;
    code: string;
    branch?: { name?: string | null } | null;
  };
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  branch?: { name?: string | null } | null;
};

type OperationCard = {
  label: string;
  value: number;
  hint: string;
  tone?: string;
};

type BarcodeDashboard = {
  operationCards: OperationCard[];
  barcodeReadiness?: {
    productsWithBarcode: number;
    productsWithoutBarcode: number;
    locationsWithBarcode: number;
    locationsWithoutBarcode: number;
  };
};

interface BarcodesClientProps {
  products: Product[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  dashboard: BarcodeDashboard;
}

type ScanMode = "products" | "locations" | "operations";
type LabelTarget = "products" | "locations";
type ProductFilter = "all" | "withBarcode" | "missingBarcode" | "lowStock";
type BarcodeFormat = "code128" | "gs1-128" | "datamatrix";

const barcodeFormatLabels: Record<BarcodeFormat, string> = {
  code128: "Code 128",
  "gs1-128": "GS1-128",
  datamatrix: "Data Matrix",
};

const operationIcons: Record<string, typeof Truck> = {
  Receipts: Truck,
  "Delivery Orders": PackageCheck,
  "Internal Transfers": ArrowLeftRight,
  Replenishment: PackageSearch,
  Adjustments: ClipboardCheck,
  "Batch Transfers": Layers3,
};

const exportColumns = [
  { key: "name", label: "Product" },
  { key: "sku", label: "SKU" },
  { key: "barcode", label: "Barcode" },
  { key: "stock", label: "Stock" },
  { key: "sellingPrice", label: "Price" },
];

function BarcodeImage({ value, format = "code128", className }: { value?: string | null; format?: BarcodeFormat; className?: string }) {
  if (!value) return <div className={`flex items-center justify-center rounded border bg-muted/30 text-xs text-muted-foreground ${className || "h-11"}`}>No barcode</div>;
  const props = new URLSearchParams({ text: value, symbology: format, scale: "2", height: "30" });
  return <img src={`/api/barcodes/render?${props}`} alt={value} className={className || "h-11"} loading="eager" decoding="sync" />;
}

function textMatch(value: unknown, query: string) {
  return String(value || "")
    .toLowerCase()
    .includes(query);
}

export function BarcodesClient({
  products,
  warehouses,
  locations,
  dashboard,
}: BarcodesClientProps) {
  const { addToast } = useToast();
  const scanRef = useRef<HTMLInputElement>(null);
  const [productRows, setProductRows] = useState(products);
  const [search, setSearch] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>("products");
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [labelTarget, setLabelTarget] = useState<LabelTarget>("products");
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>("code128");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(() => new Set());
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(() => new Set());
  const [barcodeDrafts, setBarcodeDrafts] = useState<Record<string, string>>({});
  const [isSavingBarcode, startSavingBarcode] = useTransition();
  const [lastScan, setLastScan] = useState<{
    type: string;
    title: string;
    detail: string;
    status: "found" | "missing";
  } | null>(null);
  const [scanHistory, setScanHistory] = useState<string[]>([]);

  useEffect(() => {
    setProductRows(products);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.toLowerCase().trim();
    return productRows.filter((product) => {
      const matchesQuery =
        !query ||
        textMatch(product.name, query) ||
        textMatch(product.sku, query) ||
        textMatch(product.barcode, query);
      const matchesFilter =
        productFilter === "all" ||
        (productFilter === "withBarcode" && Boolean(product.barcode)) ||
        (productFilter === "missingBarcode" && !product.barcode) ||
        (productFilter === "lowStock" && product.stock <= product.minStock);
      return matchesQuery && matchesFilter;
    });
  }, [productFilter, productRows, search]);

  const locationsWithBarcode = locations.filter((location) => Boolean(location.barcode));
  const selectedProductRows = productRows.filter((product) => selectedProducts.has(product.id));
  const selectedLocationRows = locations.filter((location) => selectedLocations.has(location.id));
  const printableProducts = selectedProductRows.length
    ? selectedProductRows
    : filteredProducts.slice(0, 24);
  const printableLocations = selectedLocationRows.length
    ? selectedLocationRows
    : locationsWithBarcode.slice(0, 24);
  const printableCount =
    labelTarget === "products" ? printableProducts.length : printableLocations.length;

  function toggleSelection(setter: (value: Set<string>) => void, current: Set<string>, id: string) {
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setter(next);
  }

  function handleScan(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const query = scanInput.trim().toLowerCase();
    if (!query) {
      scanRef.current?.focus();
      return;
    }

    const product = productRows.find(
      (row) =>
        textMatch(row.barcode, query) ||
        textMatch(row.sku, query) ||
        row.name.toLowerCase() === query,
    );
    const location = locations.find(
      (row) =>
        textMatch(row.barcode, query) ||
        textMatch(row.code, query) ||
        row.name.toLowerCase() === query,
    );
    const operation = dashboard.operationCards.find((row) =>
      row.label.toLowerCase().includes(query),
    );

    if (scanMode === "locations" && location) {
      setLastScan({
        type: "Location",
        title: location.name,
        detail: `${location.warehouse.code}/${location.code} - ${location.type.replace(/_/g, " ")}`,
        status: "found",
      });
      setSelectedLocations(new Set(selectedLocations).add(location.id));
    } else if (scanMode === "operations" && operation) {
      setLastScan({
        type: "Operation",
        title: operation.label,
        detail: `${operation.value} open - ${operation.hint}`,
        status: "found",
      });
    } else if (product) {
      setLastScan({
        type: "Product",
        title: product.name,
        detail: `${product.sku || "No SKU"} - ${product.stock} ${product.unit || "units"} on hand`,
        status: "found",
      });
      setSelectedProducts(new Set(selectedProducts).add(product.id));
    } else if (location) {
      setLastScan({
        type: "Location",
        title: location.name,
        detail: `${location.warehouse.code}/${location.code} - ${location.type.replace(/_/g, " ")}`,
        status: "found",
      });
      setSelectedLocations(new Set(selectedLocations).add(location.id));
    } else {
      setLastScan({
        type: "Not found",
        title: scanInput.trim(),
        detail: "No product, location, or operation matched this scan.",
        status: "missing",
      });
    }

    setScanHistory((items) => [scanInput.trim(), ...items].slice(0, 8));
    setScanInput("");
    scanRef.current?.focus();
  }

  function handlePrint() {
    window.print();
  }

  function saveProductBarcode(product: Product) {
    const barcode = (barcodeDrafts[product.id] ?? product.barcode ?? "").trim();
    startSavingBarcode(async () => {
      try {
        await updateProduct(product.id, { barcode });
        setProductRows((rows) =>
          rows.map((row) => (row.id === product.id ? { ...row, barcode } : row)),
        );
        setBarcodeDrafts((drafts) => {
          const next = { ...drafts };
          delete next[product.id];
          return next;
        });
        addToast({ title: "Barcode saved", variant: "success" });
      } catch (error) {
        addToast({
          title: error instanceof Error ? error.message : "Could not save barcode",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <style>{`
        .barcode-print-sheet { display: none; }
        @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden; }
          .barcode-print-sheet, .barcode-print-sheet * { visibility: visible; }
          .barcode-print-sheet {
            display: grid;
            position: absolute;
            inset: 0 auto auto 0;
            width: 210mm;
            height: 297mm;
            grid-template-columns: 105mm 105mm;
            grid-template-rows: repeat(7, 42.3mm);
            background: white;
          }
          .barcode-print-label {
            break-inside: avoid;
            border: none;
            padding: 3mm 4mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            overflow: hidden;
          }
          .barcode-print-label .product-name {
            font-size: 8pt;
            font-weight: 600;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .barcode-print-label .product-sku {
            font-size: 6.5pt;
            color: #6b7280;
            line-height: 1.2;
            margin-bottom: 1mm;
          }
          .barcode-print-label .product-price {
            font-size: 7pt;
            font-weight: 500;
            margin-top: 1mm;
          }
          .barcode-print-label .barcode-code {
            font-size: 6pt;
            font-family: monospace;
            text-align: center;
            margin-top: 1mm;
            color: #374151;
          }
          .barcode-print-label img {
            display: block;
            max-width: 92mm;
            max-height: 16mm;
            object-fit: contain;
            margin: 1mm auto;
          }
        }
      `}</style>

      <PageHeader
        title="Barcode Operations"
        description="Scan operations, product codes, storage locations, and print labels"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCSV(filteredProducts, exportColumns, "barcode-products")}
        >
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
        <Button size="sm" onClick={handlePrint} disabled={printableCount === 0}>
          <Printer className="mr-2 h-4 w-4" /> Print Labels
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {dashboard.operationCards.map((operation) => {
          const Icon = operationIcons[operation.label] || Barcode;
          return (
            <Card key={operation.label} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{operation.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{operation.value}</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 min-h-8 text-xs leading-4 text-muted-foreground">
                {operation.hint}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Scan or Tap</h2>
              <p className="text-sm text-muted-foreground">
                Products, locations, and operations resolve from one scanner box.
              </p>
            </div>
            <div className="flex rounded-md border p-1">
              {(["products", "locations", "operations"] as ScanMode[]).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={scanMode === mode ? "secondary" : "ghost"}
                  className="h-8 capitalize"
                  onClick={() => setScanMode(mode)}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          <form onSubmit={handleScan} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              ref={scanRef}
              value={scanInput}
              onChange={(event) => setScanInput(event.target.value)}
              placeholder="Scan barcode, SKU, location, or operation"
              className="h-11"
            />
            <Button type="submit" className="h-11 sm:w-32">
              <Search className="mr-2 h-4 w-4" /> Scan
            </Button>
          </form>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Products</p>
              <p className="mt-1 text-xl font-semibold">{productRows.length}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Product Barcodes</p>
              <p className="mt-1 text-xl font-semibold">
                {dashboard.barcodeReadiness?.productsWithBarcode ??
                  productRows.filter((p) => p.barcode).length}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Locations</p>
              <p className="mt-1 text-xl font-semibold">{locations.length}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Warehouses</p>
              <p className="mt-1 text-xl font-semibold">{warehouses.length}</p>
            </Card>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold">Last Scan</h2>
          {lastScan ? (
            <div className="mt-4 rounded-md border p-3">
              <div className="flex items-start gap-3">
                <span
                  className={
                    lastScan.status === "found"
                      ? "mt-0.5 text-emerald-600"
                      : "mt-0.5 text-destructive"
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <Badge variant={lastScan.status === "found" ? "secondary" : "destructive"}>
                    {lastScan.type}
                  </Badge>
                  <p className="mt-2 truncate font-medium">{lastScan.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{lastScan.detail}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Waiting for scan
            </div>
          )}
          <div className="mt-4 space-y-2">
            {scanHistory.map((item, index) => (
              <div key={`${item}-${index}`} className="flex items-center gap-2 text-sm">
                <Barcode className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{item}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products, SKU, barcode"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["withBarcode", "With barcode"],
                ["missingBarcode", "No barcode"],
                ["lowStock", "Low stock"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={productFilter === value ? "secondary" : "outline"}
                  onClick={() => setProductFilter(value as ProductFilter)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() =>
                            toggleSelection(setSelectedProducts, selectedProducts, product.id)
                          }
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[220px] items-center gap-2">
                          <Barcode className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {product.sku || "No SKU"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[210px] items-center gap-2">
                          <input
                            value={barcodeDrafts[product.id] ?? product.barcode ?? ""}
                            onChange={(event) =>
                              setBarcodeDrafts((drafts) => ({
                                ...drafts,
                                [product.id]: event.target.value,
                              }))
                            }
                            className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
                            placeholder="Barcode"
                          />
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            disabled={
                              isSavingBarcode ||
                              (barcodeDrafts[product.id] ?? product.barcode ?? "") ===
                                (product.barcode ?? "")
                            }
                            onClick={() => saveProductBarcode(product)}
                            title="Save barcode"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={product.stock <= product.minStock ? "destructive" : "secondary"}
                        >
                          {product.stock} {product.unit || ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(product.sellingPrice || 0))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Labels</h2>
              <p className="text-sm text-muted-foreground">{printableCount} ready to print</p>
            </div>
            <div className="flex rounded-md border p-1">
              {(["products", "locations"] as LabelTarget[]).map((target) => (
                <Button
                  key={target}
                  type="button"
                  size="sm"
                  variant={labelTarget === target ? "secondary" : "ghost"}
                  className="h-8 capitalize"
                  onClick={() => setLabelTarget(target)}
                >
                  {target}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Barcode Format</label>
            <select
              value={barcodeFormat}
              onChange={(e) => setBarcodeFormat(e.target.value as BarcodeFormat)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {(Object.entries(barcodeFormatLabels) as [BarcodeFormat, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {locations.slice(0, 10).map((location) => (
              <label
                key={location.id}
                className="flex items-start gap-3 rounded-md border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedLocations.has(location.id)}
                  onChange={() =>
                    toggleSelection(setSelectedLocations, selectedLocations, location.id)
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{location.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {location.warehouse.code}/{location.code}
                  </span>
                </span>
                <Badge variant={location.barcode ? "secondary" : "outline"}>
                  {location.barcode ? "Barcode" : "Code"}
                </Badge>
              </label>
            ))}
          </div>
        </Card>
      </div>

      <div className="barcode-print-sheet">
        {labelTarget === "products"
          ? printableProducts.map((product) => {
              const barcodeValue = product.barcode || product.sku || product.id;
              return (
                <div key={product.id} className="barcode-print-label">
                  <p className="product-name">{product.name}</p>
                  <p className="product-sku">SKU: {product.sku || "-"}</p>
                  <BarcodeImage value={barcodeValue} format={barcodeFormat} />
                  <p className="barcode-code">{barcodeValue}</p>
                  <p className="product-price">{formatCurrency(Number(product.sellingPrice || 0))}</p>
                </div>
              );
            })
          : printableLocations.map((location) => {
              const barcodeValue = location.barcode || location.code;
              return (
                <div key={location.id} className="barcode-print-label">
                  <p className="product-name">{location.name}</p>
                  <p className="product-sku">{location.warehouse.code}/{location.code}</p>
                  <BarcodeImage value={barcodeValue} format={barcodeFormat} />
                  <p className="barcode-code">{barcodeValue}</p>
                  <p className="product-price">{location.type.replace(/_/g, " ")}</p>
                </div>
              );
            })}
      </div>
    </div>
  );
}
