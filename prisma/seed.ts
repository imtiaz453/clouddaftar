import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await hash("password123", 12);
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  const superAdminName = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  // Seed initial super admin (owner)
  if (superAdminEmail && superAdminPassword) {
    const superAdminHash = await hash(superAdminPassword, 12);
    await prisma.systemAdmin.upsert({
      where: { email: superAdminEmail },
      update: {
        name: superAdminName,
        passwordHash: superAdminHash,
        role: "OWNER",
        isActive: true,
      },
      create: {
        name: superAdminName,
        email: superAdminEmail,
        passwordHash: superAdminHash,
        role: "OWNER",
        isActive: true,
      },
    });
    console.log(`Super admin ready: ${superAdminEmail}`);
  } else {
    console.log("Skipping super admin seed. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD.");
  }

  const user = await prisma.user.upsert({
    where: { email: "admin@clouddaftar.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@clouddaftar.com",
      passwordHash,
      phone: "+92 300 1234567",
    },
  });

  const company = await prisma.company.upsert({
    where: { slug: "demo-pharmacy" },
    update: {},
    create: {
      name: "Demo Pharmacy",
      slug: "demo-pharmacy",
      phone: "+92 300 1234567",
      email: "info@demopharmacy.com",
      address: "123 Main Street",
      city: "Karachi",
      state: "Sindh",
      country: "PK",
      taxId: "NTN-1234567",
      taxRate: 0,
      currency: "PKR",
      currencySymbol: "Rs",
      timezone: "Asia/Karachi",
      dateFormat: "DD/MM/YYYY",
      settings: {
        create: {
          invoicePrefix: "INV",
          salesOrderPrefix: "SORD",
          proformaInvoicePrefix: "PI",
          quotationPrefix: "QUOT",
          purchaseOrderPrefix: "PO",
          invoiceNumberLength: 5,
          lowStockThreshold: 10,
          autoGenerateSKU: true,
          skuPrefix: "DMO",
          enableBarcodeScanning: true,
        },
      },
      theme: {
        create: {
          sidebarColor: "slate",
          sidebarStyle: "gradient",
          primaryColor: "blue",
          fontFamily: "inter",
          borderRadius: "normal",
          layoutDensity: "comfortable",
        },
      },
    },
  });

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: {},
    create: {
      userId: user.id,
      companyId: company.id,
      role: "OWNER",
    },
  });

  const categories = [
    { name: "Tablets", description: "Tablet medications", color: "#3b82f6" },
    { name: "Capsules", description: "Capsule medications", color: "#8b5cf6" },
    { name: "Syrups", description: "Liquid medications", color: "#10b981" },
    { name: "Injections", description: "Injectable medications", color: "#f59e0b" },
    { name: "Topical", description: "Creams and ointments", color: "#ef4444" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name_companyId: { name: cat.name, companyId: company.id } },
      update: {},
      create: { ...cat, companyId: company.id },
    });
  }

  const allCategories = await prisma.category.findMany({
    where: { companyId: company.id },
  });

  const products = [
    {
      name: "Panadol Extra 500mg",
      sku: "DMO-001",
      barcode: "8901234567890",
      purchasePrice: 80,
      sellingPrice: 120,
      stock: 500,
      minStock: 50,
      unit: "pcs",
      categoryIndex: 0,
    },
    {
      name: "Risek 20mg Capsules",
      sku: "DMO-002",
      barcode: "8901234567891",
      purchasePrice: 150,
      sellingPrice: 220,
      stock: 300,
      minStock: 30,
      unit: "pcs",
      categoryIndex: 1,
    },
    {
      name: "Brufen 400mg",
      sku: "DMO-003",
      barcode: "8901234567892",
      purchasePrice: 90,
      sellingPrice: 150,
      stock: 400,
      minStock: 40,
      unit: "pcs",
      categoryIndex: 0,
    },
    {
      name: "Augmentin 1g Injection",
      sku: "DMO-004",
      barcode: "8901234567893",
      purchasePrice: 350,
      sellingPrice: 500,
      stock: 100,
      minStock: 10,
      unit: "vial",
      categoryIndex: 3,
    },
    {
      name: "Cough Syrup",
      sku: "DMO-005",
      barcode: "8901234567894",
      purchasePrice: 120,
      sellingPrice: 180,
      stock: 200,
      minStock: 20,
      unit: "bottle",
      categoryIndex: 2,
    },
  ];

  for (const product of products) {
    const { categoryIndex, ...productData } = product;
    await prisma.product.upsert({
      where: { sku_companyId: { sku: productData.sku, companyId: company.id } },
      update: {},
      create: {
        ...productData,
        companyId: company.id,
        categoryId: allCategories[categoryIndex]?.id,
      },
    });
  }

  const customers = [
    { name: "Ali Khan", phone: "+92 300 1111111", city: "Karachi" },
    { name: "Sara Ahmed", phone: "+92 300 2222222", city: "Lahore" },
    { name: "Usman Malik", phone: "+92 300 3333333", city: "Islamabad" },
  ];

  for (const customer of customers) {
    await prisma.customer.create({ data: { ...customer, companyId: company.id } });
  }

  const suppliers = [
    { name: "PharmaLink Distributors", phone: "+92 21 1111111", city: "Karachi" },
    { name: "MediStar Wholesale", phone: "+92 42 2222222", city: "Lahore" },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.create({ data: { ...supplier, companyId: company.id } });
  }

  const plans = [
    {
      name: "Starter",
      code: "starter",
      description: "30-day trial for small businesses starting out",
      monthlyPrice: 0,
      yearlyPrice: 0,
      userLimit: 2,
      storageLimitMB: 100,
      features: [
        "30-day trial",
        "Basic inventory",
        "Sales & purchases",
        "Customer management",
        "Email support",
      ],
      sortOrder: 1,
    },
    {
      name: "Business",
      code: "business",
      description: "For growing businesses with more needs",
      monthlyPrice: 1999,
      yearlyPrice: 19990,
      userLimit: 10,
      storageLimitMB: 1000,
      features: [
        "Everything in Starter",
        "Advanced reporting",
        "Supplier management",
        "Priority support",
        "API access",
        "Multiple users",
      ],
      sortOrder: 2,
    },
    {
      name: "Enterprise",
      code: "enterprise",
      description: "Full-featured for large organizations",
      monthlyPrice: 4999,
      yearlyPrice: 49990,
      userLimit: 50,
      storageLimitMB: 5000,
      features: [
        "Everything in Business",
        "Unlimited users",
        "Custom branding",
        "Dedicated support",
        "White-label",
        "SLA guarantee",
      ],
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {},
      create: { ...plan, features: JSON.stringify(plan.features) },
    });
  }

  const starterPlan = await prisma.subscriptionPlan.findUnique({ where: { code: "starter" } });
  if (starterPlan) {
    await prisma.tenantSubscription.upsert({
      where: { companyId: company.id },
      update: {},
      create: {
        companyId: company.id,
        planId: starterPlan.id,
        status: "TRIAL",
        billingCycle: "MONTHLY",
        startDate: new Date(),
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: false,
      },
    });
  }

  // =========== AR/AP SEED DATA ===========
  const allProducts = await prisma.product.findMany({ where: { companyId: company.id } });
  const allCustomers = await prisma.customer.findMany({ where: { companyId: company.id } });
  const allSuppliers = await prisma.supplier.findMany({ where: { companyId: company.id } });

  // Create sales invoices with various payment statuses
  const now = new Date();
  const salesData = [
    {
      customer: allCustomers[0],
      total: 15000,
      paid: 15000,
      daysSinceDue: -10,
      status: "COMPLETED",
      paymentStatus: "PAID" as const,
      method: "CASH" as const,
    },
    {
      customer: allCustomers[0],
      total: 22000,
      paid: 22000,
      daysSinceDue: -5,
      status: "COMPLETED",
      paymentStatus: "PAID" as const,
      method: "CARD" as const,
    },
    {
      customer: allCustomers[1],
      total: 8500,
      paid: 5000,
      daysSinceDue: 15,
      status: "COMPLETED",
      paymentStatus: "PARTIALLY_PAID" as const,
      method: "BANK_TRANSFER" as const,
    },
    {
      customer: allCustomers[1],
      total: 32000,
      paid: 0,
      daysSinceDue: 45,
      status: "COMPLETED",
      paymentStatus: "UNPAID" as const,
      method: "CASH" as const,
    },
    {
      customer: allCustomers[2],
      total: 12500,
      paid: 0,
      daysSinceDue: 75,
      status: "COMPLETED",
      paymentStatus: "UNPAID" as const,
      method: "CASH" as const,
    },
    {
      customer: allCustomers[2],
      total: 45000,
      paid: 0,
      daysSinceDue: 120,
      status: "COMPLETED",
      paymentStatus: "UNPAID" as const,
      method: "CASH" as const,
    },
    {
      customer: allCustomers[0],
      total: 7800,
      paid: 7800,
      daysSinceDue: -2,
      status: "COMPLETED",
      paymentStatus: "PAID" as const,
      method: "EASYPAISA" as const,
    },
    {
      customer: allCustomers[1],
      total: 5600,
      paid: 2000,
      daysSinceDue: 8,
      status: "COMPLETED",
      paymentStatus: "PARTIALLY_PAID" as const,
      method: "JAZZCASH" as const,
    },
  ];

  for (const sd of salesData) {
    const dueDate = new Date(now.getTime() + sd.daysSinceDue * 86400000);
    const invoiceNum = `INV-${String(Math.floor(Math.random() * 90000) + 10000)}`;
    const sale = await prisma.sale.create({
      data: {
        invoiceNumber: invoiceNum,
        subtotal: sd.total,
        total: sd.total,
        paid: sd.paid,
        due: sd.total - sd.paid,
        status: sd.status as any,
        paymentStatus: sd.paymentStatus,
        paymentMethod: sd.method,
        dueDate,
        customerId: sd.customer.id,
        companyId: company.id,
        createdById: user.id,
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        companyId: company.id,
        customerId: sd.customer.id,
        type: "INVOICE",
        referenceId: sale.id,
        referenceNumber: invoiceNum,
        debit: sd.total,
        credit: 0,
        balance: sd.total,
        entryDate: new Date(now.getTime() + sd.daysSinceDue * 86400000 - 86400000),
        description: `Invoice ${invoiceNum} for ${sd.customer.name}`,
        createdById: user.id,
      },
    });
    if (sd.paid > 0) {
      await prisma.ledgerEntry.create({
        data: {
          companyId: company.id,
          customerId: sd.customer.id,
          type: "PAYMENT",
          referenceId: sale.id,
          referenceNumber: invoiceNum,
          debit: 0,
          credit: sd.paid,
          balance: sd.total - sd.paid,
          entryDate: new Date(now.getTime() + sd.daysSinceDue * 86400000 - 43200000),
          description: `Payment received for ${invoiceNum}`,
          createdById: user.id,
        },
      });
    }
  }

  // Create purchase records with various payment statuses
  const purchaseData = [
    {
      supplier: allSuppliers[0],
      total: 45000,
      paid: 45000,
      daysSinceDue: -15,
      status: "RECEIVED" as const,
      paymentStatus: "PAID" as const,
      method: "BANK_TRANSFER" as const,
    },
    {
      supplier: allSuppliers[0],
      total: 28000,
      paid: 15000,
      daysSinceDue: 20,
      status: "RECEIVED" as const,
      paymentStatus: "PARTIALLY_PAID" as const,
      method: "CHEQUE" as const,
    },
    {
      supplier: allSuppliers[1],
      total: 35000,
      paid: 0,
      daysSinceDue: 35,
      status: "RECEIVED" as const,
      paymentStatus: "UNPAID" as const,
      method: "CASH" as const,
    },
    {
      supplier: allSuppliers[1],
      total: 52000,
      paid: 0,
      daysSinceDue: 85,
      status: "RECEIVED" as const,
      paymentStatus: "UNPAID" as const,
      method: "CASH" as const,
    },
    {
      supplier: allSuppliers[0],
      total: 18000,
      paid: 18000,
      daysSinceDue: -3,
      status: "RECEIVED" as const,
      paymentStatus: "PAID" as const,
      method: "BANK_TRANSFER" as const,
    },
    {
      supplier: allSuppliers[1],
      total: 42000,
      paid: 10000,
      daysSinceDue: 10,
      status: "RECEIVED" as const,
      paymentStatus: "PARTIALLY_PAID" as const,
      method: "EASYPAISA" as const,
    },
  ];

  for (const pd of purchaseData) {
    const dueDate = new Date(now.getTime() + pd.daysSinceDue * 86400000);
    const poNum = `PO-${String(Math.floor(Math.random() * 90000) + 10000)}`;
    const purchase = await prisma.purchase.create({
      data: {
        referenceNumber: poNum,
        subtotal: pd.total,
        total: pd.total,
        paid: pd.paid,
        due: pd.total - pd.paid,
        status: pd.status as any,
        paymentStatus: pd.paymentStatus,
        paymentMethod: pd.method,
        dueDate,
        supplierId: pd.supplier.id,
        companyId: company.id,
        createdById: user.id,
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        companyId: company.id,
        supplierId: pd.supplier.id,
        type: "PURCHASE",
        referenceId: purchase.id,
        referenceNumber: poNum,
        debit: pd.total,
        credit: 0,
        balance: pd.total,
        entryDate: new Date(now.getTime() + pd.daysSinceDue * 86400000 - 86400000),
        description: `Purchase ${poNum} from ${pd.supplier.name}`,
        createdById: user.id,
      },
    });
    if (pd.paid > 0) {
      await prisma.ledgerEntry.create({
        data: {
          companyId: company.id,
          supplierId: pd.supplier.id,
          type: "PAYMENT",
          referenceId: purchase.id,
          referenceNumber: poNum,
          debit: 0,
          credit: pd.paid,
          balance: pd.total - pd.paid,
          entryDate: new Date(now.getTime() + pd.daysSinceDue * 86400000 - 43200000),
          description: `Payment made for ${poNum}`,
          createdById: user.id,
        },
      });
    }
  }

  // Create payment reminders
  for (const cust of allCustomers) {
    await prisma.paymentReminder.create({
      data: {
        companyId: company.id,
        customerId: cust.id,
        type: "FOLLOW_UP",
        message: `Follow up with ${cust.name} for outstanding balance`,
        status: "PENDING",
        createdById: user.id,
      },
    });
  }

  console.log("AR/AP seed data created successfully!");
  console.log("Seed completed successfully!");
  console.log("Login: admin@clouddaftar.com / password123");
  console.log("Super admin login: imtiazkhan@pgfci.com / admin123");
  console.log(
    "Subscription plans seeded: Starter (free), Business (Rs 1,999/mo), Enterprise (Rs 4,999/mo)",
  );
  console.log("AR/AP data seeded: Sales (8 invoices), Purchases (6 POs), Reminders (3)");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
