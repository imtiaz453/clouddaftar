import {
  createBranch,
  createWarehouse,
  createWarehouseLocation,
  getBranches,
  getWarehouseLocations,
  getWarehouseOperationsDashboard,
  getWarehouseStock,
} from "@/actions/locations";
import { WarehouseStockFilter } from "./warehouse-stock-filter";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Suspense } from "react";
import {
  Activity,
  ArrowLeftRight,
  Barcode,
  Boxes,
  Building2,
  ClipboardCheck,
  Layers3,
  LayoutGrid,
  MapPin,
  PackageCheck,
  ScanBarcode,
  Truck,
} from "lucide-react";

const locationTypes = [
  ["INTERNAL", "Internal"],
  ["INPUT", "Input"],
  ["QUALITY", "Quality"],
  ["PACKING", "Packing"],
  ["OUTPUT", "Output"],
  ["TRANSIT", "Transit"],
  ["INVENTORY_LOSS", "Inventory Loss"],
  ["VIEW", "View"],
];

const operationIcons: Record<string, typeof Truck> = {
  Receipts: Truck,
  "Delivery Orders": PackageCheck,
  "Internal Transfers": ArrowLeftRight,
  Replenishment: Boxes,
  Adjustments: ClipboardCheck,
  "Batch Transfers": Layers3,
};

async function createBranchAction(formData: FormData) {
  "use server";
  await createBranch({
    name: String(formData.get("name") || ""),
    code: String(formData.get("code") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    address: String(formData.get("address") || ""),
    city: String(formData.get("city") || ""),
    createDefaultWarehouse: true,
  });
}

async function createWarehouseAction(formData: FormData) {
  "use server";
  await createWarehouse({
    name: String(formData.get("name") || ""),
    code: String(formData.get("code") || ""),
    branchId: String(formData.get("branchId") || "") || undefined,
    isDefault: formData.get("isDefault") === "on",
  });
}

async function createLocationAction(formData: FormData) {
  "use server";
  await createWarehouseLocation({
    name: String(formData.get("name") || ""),
    code: String(formData.get("code") || ""),
    warehouseId: String(formData.get("warehouseId") || ""),
    parentId: String(formData.get("parentId") || "") || undefined,
    type: String(formData.get("type") || "INTERNAL"),
    barcode: String(formData.get("barcode") || ""),
    removalStrategy: String(formData.get("removalStrategy") || ""),
    isReplenishable: formData.get("isReplenishable") === "on",
    isScrapLocation: formData.get("isScrapLocation") === "on",
  });
}

function typeBadge(type: string) {
  const styles: Record<string, string> = {
    VIEW: "bg-sky-100 text-sky-700",
    INTERNAL: "bg-slate-100 text-slate-700",
    INPUT: "bg-blue-100 text-blue-700",
    QUALITY: "bg-violet-100 text-violet-700",
    PACKING: "bg-fuchsia-100 text-fuchsia-700",
    OUTPUT: "bg-emerald-100 text-emerald-700",
    TRANSIT: "bg-amber-100 text-amber-700",
    INVENTORY_LOSS: "bg-rose-100 text-rose-700",
  };
  return styles[type] || "bg-muted text-muted-foreground";
}

export async function WarehousesPage({ warehouseId }: { warehouseId?: string } = {}) {
  const [branches, stock, locations, dashboard] = await Promise.all([
    getBranches(),
    getWarehouseStock({ warehouseId }),
    getWarehouseLocations(),
    getWarehouseOperationsDashboard(),
  ]);
  const warehouses = branches.flatMap((branch) =>
    branch.warehouses.map((warehouse) => ({ ...warehouse, branchName: branch.name })),
  );

  const locationOptions = locations.map((location) => ({
    id: location.id,
    label: `${location.warehouse.code}/${location.code} - ${location.name}`,
  }));

  const setupSteps = [
    {
      title: "1. Create branches",
      description: "Use branches for shops, POS counters, depots, or cities.",
    },
    {
      title: "2. Add warehouses",
      description: "Attach one or more warehouses to each branch that holds stock.",
    },
    {
      title: "3. Define locations",
      description: "Create shelves, receiving, quality, packing, output, and scrap locations.",
    },
    {
      title: "4. Monitor stock",
      description: "Review stock split by warehouse and products that need replenishment.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Management"
        description="Set up branches, warehouses, shelf locations, and stock replenishment"
      >
        <Button asChild variant="outline" size="sm">
          <a href="../barcodes">
            <ScanBarcode className="mr-2 h-4 w-4" />
            Barcode Operations
          </a>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          {setupSteps.map((step) => (
            <div key={step.title} className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="setup">Branches & Warehouses</TabsTrigger>
          <TabsTrigger value="locations">Storage Locations</TabsTrigger>
          <TabsTrigger value="stock">Stock & Replenishment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {dashboard.operationCards.map((operation) => {
              const Icon = operationIcons[operation.label] || Activity;
              return (
                <Card key={operation.label} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{operation.label}</p>
                      <p className="mt-1 text-2xl font-semibold">{operation.value}</p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{operation.hint}</p>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Branches</p>
              <p className="mt-1 text-xl font-semibold">{branches.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Warehouses</p>
              <p className="mt-1 text-xl font-semibold">{dashboard.totals.warehouses}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Storage Locations</p>
              <p className="mt-1 text-xl font-semibold">{dashboard.totals.locations}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Products to Reorder</p>
              <p className="mt-1 text-xl font-semibold">{dashboard.totals.lowStockProducts}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Product Barcodes</p>
              <p className="mt-1 text-xl font-semibold">
                {dashboard.barcodeReadiness.productsWithBarcode}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Location Barcodes</p>
              <p className="mt-1 text-xl font-semibold">
                {dashboard.barcodeReadiness.locationsWithBarcode}
              </p>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Barcode className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Barcode readiness</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Products missing barcode</p>
                <p className="mt-1 text-xl font-semibold">
                  {dashboard.barcodeReadiness.productsWithoutBarcode}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Locations missing barcode</p>
                <p className="mt-1 text-xl font-semibold">
                  {dashboard.barcodeReadiness.locationsWithoutBarcode}
                </p>
              </div>
              {Object.entries(dashboard.locationTypeCounts)
                .slice(0, 6)
                .map(([type, count]) => (
                  <div key={type} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{type.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xl font-semibold">{count}</p>
                  </div>
                ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Warehouses at a glance</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Each branch can have one or more warehouses. Warehouses contain storage locations such
              as receiving, stock, quality, packing, output, and scrap.
            </p>
            <div className="mt-4 space-y-3 md:hidden">
              {dashboard.warehouses.map((warehouse) => {
                const onHand = warehouse.productStocks.reduce((sum, row) => sum + row.quantity, 0);
                return (
                  <div key={warehouse.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{warehouse.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {warehouse.branch?.name || "Company level"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs">
                        {warehouse.code}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Locations</p>
                        <p className="font-medium">{warehouse.locations.length}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Products</p>
                        <p className="font-medium">{warehouse.productStocks.length}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">On Hand</p>
                        <p className="font-medium">{onHand}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {warehouse.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Warehouse</th>
                    <th>Code</th>
                    <th>Branch</th>
                    <th>Locations</th>
                    <th>Products</th>
                    <th>On Hand</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.warehouses.map((warehouse) => {
                    const onHand = warehouse.productStocks.reduce(
                      (sum, row) => sum + row.quantity,
                      0,
                    );
                    return (
                      <tr key={warehouse.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{warehouse.name}</td>
                        <td>{warehouse.code}</td>
                        <td>{warehouse.branch?.name || "Company level"}</td>
                        <td>{warehouse.locations.length}</td>
                        <td>{warehouse.productStocks.length}</td>
                        <td>{onHand}</td>
                        <td>{warehouse.isActive ? "Active" : "Inactive"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="setup" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h2 className="text-base font-semibold">Create Branch</h2>
                  <p className="text-sm text-muted-foreground">
                    A branch is a business location, POS shop, depot, or city office.
                  </p>
                </div>
              </div>
              <form action={createBranchAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input name="name" label="Branch Name" required placeholder="Riyadh POS" />
                <Input name="code" label="Branch Code" placeholder="RYD" />
                <Input name="phone" label="Phone" />
                <Input name="email" label="Email" />
                <Input name="city" label="City" />
                <Input name="address" label="Address" />
                <div className="sm:col-span-2">
                  <Button type="submit" className="w-full sm:w-auto">
                    Create Branch + Default Warehouse
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h2 className="text-base font-semibold">Create Warehouse</h2>
                  <p className="text-sm text-muted-foreground">
                    A warehouse is where stock is stored under a branch.
                  </p>
                </div>
              </div>
              <form action={createWarehouseAction} className="mt-4 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    name="name"
                    label="Warehouse Name"
                    required
                    placeholder="Central Warehouse"
                  />
                  <Input name="code" label="Warehouse Code" placeholder="WH" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Branch</label>
                  <select
                    name="branchId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Company level</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input name="isDefault" type="checkbox" className="h-4 w-4" />
                  Default warehouse for this branch
                </label>
                <Button type="submit" className="w-full sm:w-auto">
                  Create Warehouse
                </Button>
              </form>
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="text-base font-semibold">Branches and warehouses</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this list to confirm each branch has the correct warehouses attached.
            </p>
            <div className="mt-3 space-y-3 md:hidden">
              {branches.map((branch) => (
                <div key={branch.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[branch.city, branch.address].filter(Boolean).join(", ") || "-"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs">
                      {branch.code}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {branch.warehouses.length} warehouses
                    </span>
                    <span>{branch.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Branch</th>
                    <th>Code</th>
                    <th>Warehouses</th>
                    <th>Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr key={branch.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{branch.name}</td>
                      <td>{branch.code}</td>
                      <td>{branch.warehouses.length}</td>
                      <td>{[branch.city, branch.address].filter(Boolean).join(", ") || "-"}</td>
                      <td>{branch.isActive ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h2 className="text-base font-semibold">Create Storage Location</h2>
                  <p className="text-sm text-muted-foreground">
                    Locations are shelves, bins, receiving areas, packing areas, or scrap areas
                    inside a warehouse.
                  </p>
                </div>
              </div>
              <form action={createLocationAction} className="mt-4 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    name="name"
                    label="Location Name"
                    required
                    placeholder="Aisle A / Shelf 01"
                  />
                  <Input name="code" label="Location Code" placeholder="WH-A01" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Warehouse</label>
                    <select
                      name="warehouseId"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.code} - {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Location Type</label>
                    <select
                      name="type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {locationTypes.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Parent Location</label>
                  <select
                    name="parentId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No parent</option>
                    {locationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="barcode" label="Barcode" />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Removal Strategy</label>
                    <select
                      name="removalStrategy"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Not set</option>
                      <option value="FIFO">FIFO</option>
                      <option value="LIFO">LIFO</option>
                      <option value="FEFO">FEFO</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input name="isReplenishable" type="checkbox" className="h-4 w-4" />
                    Replenishable
                  </label>
                  <label className="flex items-center gap-2">
                    <input name="isScrapLocation" type="checkbox" className="h-4 w-4" />
                    Scrap location
                  </label>
                </div>
                <Button type="submit" className="w-full sm:w-auto">
                  Create Location
                </Button>
              </form>
            </Card>

            <Card className="p-4">
              <h2 className="text-base font-semibold">Storage Locations</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirm how goods flow through receiving, stock, quality, packing, output, and
                scrap.
              </p>
              <div className="mt-3 space-y-3 md:hidden">
                {locations.map((location) => (
                  <div key={location.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{location.name}</p>
                        <p className="text-xs text-muted-foreground">{location.code}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${typeBadge(location.type)}`}
                      >
                        {location.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Warehouse</p>
                        <p className="font-medium">{location.warehouse.name}</p>
                        <p className="text-muted-foreground">
                          {location.warehouse.branch?.name || "Company level"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-muted-foreground">Parent</p>
                          <p className="font-medium">{location.parent?.name || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Children</p>
                          <p className="font-medium">{location.children.length}</p>
                        </div>
                      </div>
                      <p className="text-muted-foreground">
                        {[
                          location.isReplenishable ? "Replenish" : "",
                          location.isScrapLocation ? "Scrap" : "",
                          location.removalStrategy || "",
                        ]
                          .filter(Boolean)
                          .join(", ") || "No routes"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2">Location</th>
                      <th>Warehouse</th>
                      <th>Type</th>
                      <th>Parent</th>
                      <th>Routes</th>
                      <th>Children</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((location) => (
                      <tr key={location.id} className="border-b last:border-0">
                        <td className="py-2">
                          <p className="font-medium">{location.name}</p>
                          <p className="text-xs text-muted-foreground">{location.code}</p>
                        </td>
                        <td>
                          <p>{location.warehouse.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {location.warehouse.branch?.name || "Company level"}
                          </p>
                        </td>
                        <td>
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${typeBadge(location.type)}`}
                          >
                            {location.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>{location.parent?.name || "-"}</td>
                        <td>
                          {[
                            location.isReplenishable ? "Replenish" : "",
                            location.isScrapLocation ? "Scrap" : "",
                            location.removalStrategy || "",
                          ]
                            .filter(Boolean)
                            .join(", ") || "-"}
                        </td>
                        <td>{location.children.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <Suspense fallback={null}>
            <WarehouseStockFilter
              warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
              currentWarehouseId={warehouseId}
            />
          </Suspense>

          <Card className="p-4">
            <h2 className="text-base font-semibold">Stock by Warehouse</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review which products are split across warehouses and which need replenishment.
            </p>
            <div className="mt-3 space-y-3 md:hidden">
              {stock.map((product) => {
                const needsReplenishment = product.stock <= product.minStock;
                return (
                  <div key={product.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku || "-"}</p>
                      </div>
                      <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs">
                        {product.stock}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {product.stockLocations.length === 0
                        ? "Not split yet"
                        : product.stockLocations
                            .map((row) => `${row.warehouse.code}: ${row.quantity}`)
                            .join(", ")}
                    </p>
                    <p
                      className={
                        needsReplenishment
                          ? "mt-2 text-xs font-medium text-amber-700"
                          : "mt-2 text-xs text-muted-foreground"
                      }
                    >
                      {needsReplenishment ? `Reorder at ${product.minStock}` : "OK"}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Product</th>
                    <th>SKU</th>
                    <th>Total Stock</th>
                    <th>Warehouse Stock</th>
                    <th>Replenishment</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((product) => {
                    const needsReplenishment = product.stock <= product.minStock;
                    return (
                      <tr key={product.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{product.name}</td>
                        <td>{product.sku || "-"}</td>
                        <td>{product.stock}</td>
                        <td>
                          {product.stockLocations.length === 0
                            ? "Not split yet"
                            : product.stockLocations
                                .map((row) => `${row.warehouse.code}: ${row.quantity}`)
                                .join(", ")}
                        </td>
                        <td>
                          <span
                            className={
                              needsReplenishment
                                ? "font-medium text-amber-700"
                                : "text-muted-foreground"
                            }
                          >
                            {needsReplenishment ? `Reorder at ${product.minStock}` : "OK"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
