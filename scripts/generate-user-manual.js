const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const outDir = path.join(__dirname, "..", "docs");
const htmlPath = path.join(outDir, "cloud-daftar-user-manual.html");
const pdfPath = path.join(outDir, "cloud-daftar-user-manual-with-screenshots.pdf");
const screenshotManifestPath = path.join(outDir, "manual-screenshots", "manifest.json");
const screenshotManifest = fs.existsSync(screenshotManifestPath)
  ? JSON.parse(fs.readFileSync(screenshotManifestPath, "utf8"))
  : { screenshots: [] };

const navGroups = [
  ["Dashboard", "Dashboard, Apps, Activity"],
  ["POS", "POS Register"],
  ["Sales", "Sales Invoices, Customer Payments, Returns, Quotations, Customer Statements"],
  ["Purchases", "Purchases, Purchase Orders, Supplier Payments, Purchase Returns, Supplier Statements"],
  ["Inventory", "Products, Categories, Units, Branches & Warehouses, Barcode Management, Stock Adjustment, Inventory Ledger, Low Stock Alerts"],
  ["Contacts", "Customers, Suppliers"],
  ["Accounting", "Dashboard, Expenses, Customer Invoices, Vendor Bills, Income / Expense, Cash Flow, Chart of Accounts, Journal Entries, Financial Reports, Reports"],
  ["Reports", "Sales Reports, Purchase Reports, Inventory Reports, Tax / VAT Reports, Receivable Aging, Payable Aging"],
  ["Expenses", "My Expenses"],
  ["Employees", "Employees, Payroll"],
  ["Administration", "Users, Roles & Permissions, Workspace Settings, Invoice Templates, Theme & Branding"],
  ["Bottom Menu", "Billing & Subscription, Help / Support, Logout"],
];

const modules = [
  {
    name: "Login",
    purpose: "Lets a registered user enter Cloud Daftar.",
    scope: "Email/password login, Google sign-in where enabled, rememberable sessions, forgot-password link, and redirect to the correct workspace.",
    impact: "Controls who can access company data. A failed login keeps business information protected; a successful login opens the user's permitted screens.",
    screens: ["Login", "Forgot Password", "Verify Reset Code", "New Password", "Register"],
    tabs: [],
    buttons: ["Sign in", "Continue with Google", "Forgot password", "Create account", "Send verification code", "Resend code", "Update password"],
    toasts: ["Welcome back", "Sign in unsuccessful", "Check your email", "Code verified", "Verification code sent", "Password updated", "Reset failed", "Account created", "Registration failed"],
  },
  {
    name: "Dashboard",
    purpose: "Gives owners and managers a quick health check of the business.",
    scope: "Total sales, month-to-date sales, products, customers, daily sales chart, purchases this month, recent sales, low-stock products, and shortcut buttons.",
    impact: "Helps the user spot sales movement, stock risk, and recent transactions before opening detailed modules.",
    screens: ["Dashboard"],
    tabs: [],
    buttons: ["Reports", "Sales", "Open purchases", "View all", "New sale"],
    toasts: [],
  },
  {
    name: "Apps",
    purpose: "Shows the available business modules as app cards.",
    scope: "POS, Sales, Purchases, Inventory, Contacts, Accounting, Expenses, Employees, Payroll, Reports, Branches & Warehouses, Templates, and Settings.",
    impact: "Acts as a simple launchpad for users who prefer choosing modules visually instead of using the sidebar.",
    screens: ["Apps"],
    tabs: [],
    buttons: ["Open app/module cards"],
    toasts: [],
  },
  {
    name: "Activity / Audit Log",
    purpose: "Shows important actions performed in the workspace.",
    scope: "User activity, admin actions, changed records, timestamps, and audit filtering where available.",
    impact: "Improves accountability and helps investigate who changed business records.",
    screens: ["Activity", "Audit Log"],
    tabs: [],
    buttons: ["Search", "Previous page", "Next page"],
    toasts: [],
  },
  {
    name: "POS Register",
    purpose: "Lets a cashier make quick counter sales.",
    scope: "Product search, barcode scan, category filter, cart, quantity/discount/price keypad, customer selection, payment method, paid amount, change, due amount, notes, draft sale, complete sale, receipt printing, fullscreen mode.",
    impact: "Creates invoices immediately, reduces manual entry at the counter, updates stock, records payment, and can print thermal receipts.",
    screens: ["POS Register", "New Sale"],
    tabs: [],
    buttons: ["Home", "Menu", "Fullscreen", "Exit fullscreen", "Search", "Category", "Add product", "Qty", "Disc", "Price", "Backspace", "Clear", "Save Draft", "Complete Sale", "Print", "New order"],
    toasts: ["Add at least one product", "Draft saved", "Sale completed", "Fullscreen is not available in this browser", "Could not switch fullscreen mode", "Error"],
  },
  {
    name: "Sales Invoices",
    purpose: "Manages all customer invoices and sales history.",
    scope: "Invoice list, search by invoice/customer, invoice status, totals, paid and due amounts, due dates, detail drawer, edit invoice details, print, download PDF, refund, convert completed invoice back to draft where allowed, and export sales.",
    impact: "Keeps revenue records organized, supports payment tracking, and feeds receivables, reports, tax, and inventory movement.",
    screens: ["Sales", "Sale Detail"],
    tabs: [],
    buttons: ["New Sale", "Export Sales", "Search", "View", "Edit", "Save", "Print", "Download PDF", "Refund", "Convert to draft"],
    toasts: ["Sale updated", "Sale refunded", "Converted to draft", "Error processing refund", "Error converting to draft", "Error"],
  },
  {
    name: "Customer Payments",
    purpose: "Records and reviews money received from customers.",
    scope: "Incoming payment list, filters, export, payment method, references, customer and invoice links.",
    impact: "Reduces outstanding receivables and keeps customer balances accurate.",
    screens: ["Customer Payments", "Receive Payment dialog"],
    tabs: [],
    buttons: ["Export CSV", "Receive payment", "Select invoices", "Record payment"],
    toasts: ["Payment recorded successfully", "Please select at least one invoice", "Payment amount must be positive", "Payment amount cannot exceed total due", "Error recording payment"],
  },
  {
    name: "Sales Returns",
    purpose: "Shows refunded or cancelled sales.",
    scope: "Return list, search, status, customer, amount, date, and CSV export.",
    impact: "Keeps revenue corrections visible and helps reconcile returned goods or cancelled invoices.",
    screens: ["Sales Returns"],
    tabs: [],
    buttons: ["Search returns", "CSV"],
    toasts: [],
  },
  {
    name: "Quotations",
    purpose: "Creates price offers before they become invoices.",
    scope: "Quotation list, search, create quotation, line items, customer, status, validity, print, PDF download, update, export CSV/Excel.",
    impact: "Supports sales follow-up without affecting stock or revenue until the customer accepts and the sale is created.",
    screens: ["Quotations", "New Quotation", "Quotation Detail"],
    tabs: [],
    buttons: ["New Quotation", "CSV", "Excel", "View", "Edit", "Print", "Download", "Save", "Cancel"],
    toasts: ["Quotation created", "Quotation updated", "Add at least one item", "Failed to create quotation", "Failed to update quotation"],
  },
  {
    name: "Customer Statements",
    purpose: "Shows a customer's full transaction history.",
    scope: "Customer selection, date range, invoices, payments, opening/closing balance, CSV export, PDF download.",
    impact: "Helps answer customer balance questions and supports collections.",
    screens: ["Customer Statement"],
    tabs: [],
    buttons: ["Select customer", "Generate Statement", "Export CSV", "Download PDF"],
    toasts: [],
  },
  {
    name: "Purchases",
    purpose: "Records supplier purchases and bills.",
    scope: "Purchase list, supplier, items, cost, status, taxes, payments, new purchase dialog, and supplier linkage.",
    impact: "Updates stock costs, payables, supplier history, and purchase reports.",
    screens: ["Purchases", "New Purchase"],
    tabs: [],
    buttons: ["New Purchase", "Save", "Cancel", "Search", "View/Edit"],
    toasts: ["Purchase created", "Purchase updated", "Error"],
  },
  {
    name: "Purchase Orders",
    purpose: "Tracks purchase requests before final purchase billing.",
    scope: "Draft and approved purchase orders, suppliers, items, expected cost, and order status.",
    impact: "Improves purchasing control before inventory and payables are affected.",
    screens: ["Purchase Orders"],
    tabs: [],
    buttons: ["Create order", "Approve", "View", "Edit"],
    toasts: [],
  },
  {
    name: "Supplier Payments",
    purpose: "Records outgoing payments to suppliers.",
    scope: "Payment list, supplier invoices, selected bills, amount paid, payment method, notes, and export.",
    impact: "Reduces payables and keeps supplier balances correct.",
    screens: ["Supplier Payments", "Supplier Payment dialog"],
    tabs: [],
    buttons: ["Export CSV", "Pay supplier", "Select invoices", "Record payment"],
    toasts: ["Select at least one invoice", "Supplier is missing for this payable", "Enter a valid amount", "Amount exceeds total due", "Payment recorded successfully", "Error processing payment"],
  },
  {
    name: "Purchase Returns",
    purpose: "Shows returned or cancelled purchases.",
    scope: "Return list, supplier, purchase reference, status, amount, date, search, and export.",
    impact: "Keeps supplier corrections visible and helps inventory/accounting stay aligned.",
    screens: ["Purchase Returns"],
    tabs: [],
    buttons: ["Search", "CSV"],
    toasts: [],
  },
  {
    name: "Supplier Statements",
    purpose: "Shows a supplier's full transaction history.",
    scope: "Supplier selection, date range, bills, payments, balances, CSV export, PDF download.",
    impact: "Helps verify vendor balances and payment disputes.",
    screens: ["Supplier Statement"],
    tabs: [],
    buttons: ["Select supplier", "Generate Statement", "Export CSV", "Download PDF"],
    toasts: [],
  },
  {
    name: "Inventory",
    purpose: "Manages products, stock levels, warehouses, traceability, and valuation.",
    scope: "Products, operations, replenishment, warehouses, traceability, reporting, product images, SKU/barcode, categories, units, price, stock, stock transfer, import, export, add lot/serial, stock ledger, and stock adjustment.",
    impact: "Controls what can be sold, where stock is stored, when to reorder, and how product movement is audited.",
    screens: ["Inventory", "Product dialog", "Transfer Stock", "Adjust Stock", "Stock Ledger", "Add Lot / Serial"],
    tabs: ["Operations", "Products", "Replenishment", "Warehouses", "Traceability", "Reporting"],
    buttons: ["Add Product", "Transfer Stock", "Import Products", "Export Products", "Search products", "Edit", "Delete", "Adjust", "Ledger", "Add Lot / Serial", "Save", "Cancel"],
    toasts: ["Product created", "Product updated", "Product deleted", "Stock adjusted", "Stock transferred", "Traceability record created", "Could not save lot or serial", "Transfer failed", "Error deleting product", "Error adjusting stock"],
  },
  {
    name: "Categories",
    purpose: "Groups products into simple product families.",
    scope: "Category name, description, color, create, edit, and save.",
    impact: "Makes product search, filtering, reporting, and POS category browsing easier.",
    screens: ["Categories"],
    tabs: [],
    buttons: ["New Category", "Edit", "Save", "Cancel"],
    toasts: ["Name is required", "Category created", "Category updated", "Failed to save category"],
  },
  {
    name: "Units",
    purpose: "Defines product measuring units.",
    scope: "Unit name and symbol such as Kilogram/kg, Meter/m, Box/box.",
    impact: "Keeps sales, purchases, and inventory quantities clear and consistent.",
    screens: ["Settings > Units"],
    tabs: [],
    buttons: ["Add Unit", "Edit unit", "Delete unit", "Save", "Cancel"],
    toasts: ["Unit name is required", "Unit created", "Unit updated", "Unit deleted", "Error"],
  },
  {
    name: "Branches & Warehouses",
    purpose: "Sets up where stock is physically held.",
    scope: "Branches, warehouses, locations such as receiving, quality, shelves, packing, output, scrap, stock by warehouse, and replenishment guidance.",
    impact: "Enables location-wise stock control and cleaner transfers between shops, depots, and counters.",
    screens: ["Warehouse Management"],
    tabs: [],
    buttons: ["Open Barcode Operations", "Open Stock Adjustments", "Create branches", "Add warehouses", "Define locations", "Monitor stock"],
    toasts: [],
  },
  {
    name: "Barcode Management",
    purpose: "Supports barcode scanning, printing, and warehouse operations.",
    scope: "Scan barcode/SKU/location/operation, search products, assign barcode, print labels, export barcode product list.",
    impact: "Speeds up counter sales, receiving, picking, and stock lookup while reducing typing mistakes.",
    screens: ["Barcode Operations"],
    tabs: [],
    buttons: ["Export", "Print labels", "Scan", "Search", "Assign barcode", "Save barcode"],
    toasts: ["Barcode saved", "Error"],
  },
  {
    name: "Stock Adjustments",
    purpose: "Corrects product stock manually.",
    scope: "Product search, current stock, positive or negative adjustment quantity, reason/notes.",
    impact: "Fixes stock after damage, counting differences, samples, or missing items. It changes inventory numbers, so it should be used carefully.",
    screens: ["Stock Adjustments"],
    tabs: [],
    buttons: ["Search products", "Adjust", "Save", "Cancel"],
    toasts: ["Stock adjusted", "Error adjusting stock"],
  },
  {
    name: "Inventory Ledger",
    purpose: "Shows every stock movement.",
    scope: "Product filter, movement type filter, date filters, sales/purchase/adjustment/transfer movements, CSV/Excel export.",
    impact: "Provides audit history for why stock increased or decreased.",
    screens: ["Inventory Ledger"],
    tabs: [],
    buttons: ["Filter", "CSV", "Excel", "Previous page", "Next page"],
    toasts: [],
  },
  {
    name: "Low Stock Alerts",
    purpose: "Shows products below the minimum stock level.",
    scope: "Product search, low stock list, threshold comparison, and CSV export.",
    impact: "Helps prevent missed sales by warning the team before items run out.",
    screens: ["Low Stock Alerts"],
    tabs: [],
    buttons: ["Search products", "CSV"],
    toasts: [],
  },
  {
    name: "Customers",
    purpose: "Stores customer contact and business details.",
    scope: "Customer list, add customer, import customers, view customer profile, contact fields, tax/payment details where present.",
    impact: "Improves invoicing, payment collection, statements, and reporting by keeping customer records consistent.",
    screens: ["Customers", "Add Customer", "Customer Detail"],
    tabs: [],
    buttons: ["Add Customer", "Import Customers", "Save", "Cancel", "View"],
    toasts: ["Customer created", "Customer updated", "Import failed"],
  },
  {
    name: "Suppliers",
    purpose: "Stores supplier and vendor details.",
    scope: "Supplier list, add supplier, import suppliers, view supplier profile and related purchase/payment data.",
    impact: "Improves purchase entry, supplier statements, and payable tracking.",
    screens: ["Suppliers", "Add Supplier", "Supplier Detail"],
    tabs: [],
    buttons: ["Add Supplier", "Import Suppliers", "Save", "Cancel", "View"],
    toasts: ["Supplier created", "Error", "Import failed"],
  },
  {
    name: "Accounting Dashboard",
    purpose: "Brings accounting work into one place.",
    scope: "Invoices, vendor bills, cash, reports, approvals, receivables, payables, expenses, and accounting shortcuts.",
    impact: "Helps finance users move quickly between money owed, money due, reports, and approvals.",
    screens: ["Accounting"],
    tabs: [],
    buttons: ["Create invoice", "Record bill", "Open receivables", "Open payables", "Open reports"],
    toasts: [],
  },
  {
    name: "Accounting Expenses",
    purpose: "Lets accounting review employee-submitted expenses.",
    scope: "Submitted expenses, receipt URL, categories, approval, rejection, reimbursement status.",
    impact: "Controls which expenses become company costs and which reimbursements are owed.",
    screens: ["Accounting Expenses"],
    tabs: [],
    buttons: ["Approve", "Reject", "Mark reimbursed"],
    toasts: ["Expense approved", "Expense rejected", "Expense reimbursed", "Error"],
  },
  {
    name: "Accounts Receivable",
    purpose: "Tracks money customers still owe.",
    scope: "Outstanding invoices, due dates, overdue amounts, reminders, invoice detail, receive payment, aging.",
    impact: "Improves collections and cash visibility.",
    screens: ["Accounts Receivable", "Receivables", "Customer Aging", "Customer Ledger"],
    tabs: [],
    buttons: ["Export CSV", "Export Excel", "View invoice", "Send reminder", "Receive payment", "Previous page", "Next page"],
    toasts: ["Payment reminder sent", "Reminder sent", "Error loading receivables", "Error sending reminder"],
  },
  {
    name: "Accounts Payable",
    purpose: "Tracks money owed to suppliers.",
    scope: "Vendor bills, due dates, overdue payables, supplier detail, supplier payment, payable aging.",
    impact: "Helps schedule payments and avoid missed vendor obligations.",
    screens: ["Accounts Payable", "Vendor Bills", "Supplier Aging", "Supplier Ledger"],
    tabs: [],
    buttons: ["View bill", "Pay supplier", "Send reminder", "Previous page", "Next page"],
    toasts: ["Reminder sent", "Payment recorded successfully", "Error"],
  },
  {
    name: "Income & Expense",
    purpose: "Compares income, costs, and profit.",
    scope: "Date filters, income, expense, profit/loss values, charts or tables, export where available.",
    impact: "Shows whether the business is making or losing money over a selected period.",
    screens: ["Income & Expense"],
    tabs: [],
    buttons: ["Filter", "CSV", "Excel"],
    toasts: [],
  },
  {
    name: "Cash Flow",
    purpose: "Shows money coming in and going out.",
    scope: "Cash inflows, outflows, date range filters, exports, transaction drilldown.",
    impact: "Helps plan cash needs and identify tight periods.",
    screens: ["Cash Flow"],
    tabs: [],
    buttons: ["Filter", "CSV", "Excel", "Previous page", "Next page"],
    toasts: [],
  },
  {
    name: "Chart of Accounts",
    purpose: "Defines the account structure used by accounting.",
    scope: "Account code, name, type, parent account, description, create/edit/deactivate.",
    impact: "Controls how transactions are classified. Bad account setup can make reports confusing, so changes should be deliberate.",
    screens: ["Chart of Accounts", "New Account", "Edit Account"],
    tabs: [],
    buttons: ["New Account", "Create", "Update", "Cancel", "Deactivate"],
    toasts: ["Account created", "Account updated", "Account deactivated", "Error"],
  },
  {
    name: "Journal Entries",
    purpose: "Records manual accounting entries.",
    scope: "Date, description, journal type, reference, debit lines, credit lines, add/remove lines, post entry.",
    impact: "Directly affects financial accounts and reports. Entries must balance before posting.",
    screens: ["Journal Entries", "New Journal Entry"],
    tabs: [],
    buttons: ["New Entry", "Add line", "Remove line", "Post", "Cancel"],
    toasts: ["Unbalanced entry", "Journal entry posted", "Error"],
  },
  {
    name: "Financial Reports",
    purpose: "Produces core accounting reports.",
    scope: "General ledger, trial balance, financial statements, date filters, and CSV export.",
    impact: "Supports owner review, accountant checks, and period-end reporting.",
    screens: ["Financial Reports"],
    tabs: ["General Ledger", "Trial Balance", "Financial Statements"],
    buttons: ["Run report", "Export CSV"],
    toasts: [],
  },
  {
    name: "Accounting Reports",
    purpose: "Generates operational accounting reports.",
    scope: "Aging report, collections, outstanding balances, payment history, and export.",
    impact: "Helps finance teams chase payments and understand collection/payment patterns.",
    screens: ["Accounting Reports"],
    tabs: ["Aging Report", "Collections", "Outstanding", "Payment History"],
    buttons: ["Export", "Filter"],
    toasts: ["Exported", "Failed to load aging report", "Failed to load collections", "Failed to load outstanding report", "Failed to load payment history"],
  },
  {
    name: "Reports",
    purpose: "Provides cross-module summaries and report shortcuts.",
    scope: "Revenue, month-to-date, purchases, products, customers, and links to sales, purchase, inventory, tax, customer statement, and supplier statement reports.",
    impact: "Turns daily business data into management-level information.",
    screens: ["Reports", "Sales Reports", "Purchase Reports", "Inventory Reports", "Tax / VAT Reports", "Receivable Aging", "Payable Aging"],
    tabs: [],
    buttons: ["Export Summary", "Open report", "CSV"],
    toasts: [],
  },
  {
    name: "My Expenses",
    purpose: "Lets staff submit expenses for approval.",
    scope: "Description, category, amount, date, receipt URL, status, and personal expense history.",
    impact: "Creates a clear reimbursement trail and gives accounting a review queue.",
    screens: ["My Expenses", "New Expense"],
    tabs: [],
    buttons: ["New Expense", "Submit", "Cancel"],
    toasts: ["Description is required", "Enter a valid amount", "Expense submitted for approval", "Error"],
  },
  {
    name: "Employees",
    purpose: "Manages staff records and HR readiness.",
    scope: "Employee directory, departments, contracts, onboarding, reporting, retention, add employee, employee detail, equipment, certifications, role and branch assignment.",
    impact: "Keeps team information, responsibility, equipment, and HR status organized.",
    screens: ["Employees", "Employee Detail", "Add Employee", "Edit Employee", "Assign Equipment", "Add Certification"],
    tabs: ["Directory", "Departments", "Contracts", "Onboarding", "Reporting", "Retention"],
    buttons: ["Add Employee", "Back", "Edit", "Assign Equipment", "Return", "Add Certification", "Remove", "Save", "Cancel"],
    toasts: ["Employee added", "Profile updated", "Role updated", "Branch updated", "Equipment assigned", "Equipment returned", "Certification added", "Certification removed", "Error"],
  },
  {
    name: "Payroll",
    purpose: "Manages salary contracts, payroll calculation, and payslip workflow.",
    scope: "Dashboard metrics, contracts, salary rules, work entries, adjustments, payslips, batches, compute payslips, verify/approve/pay/cancel, and exports.",
    impact: "Turns attendance, contracts, and adjustments into payroll records. It affects employee pay and accounting costs.",
    screens: ["Payroll", "Contract dialog", "Salary Rule dialog", "Payslip dialog", "Batch dialog", "Work Entry dialog", "Adjustment dialog"],
    tabs: ["Dashboard", "Contracts", "Work Entries", "Payslips", "Batches", "Salary Rules", "Adjustments", "Reports"],
    buttons: ["New Contract", "New Rule", "New Payslip", "New Batch", "Add Work Entry", "Add Adjustment", "Compute", "Verify", "Approve", "Mark Paid", "Cancel", "Delete", "Export"],
    toasts: ["Contract created", "Salary rule created", "Rule deleted", "Payslip drafted", "Payslip verified", "Payslip approved", "Payslip paid", "Payslip deleted", "Batch created", "Computed payslips", "Batch approved", "Batch paid", "Batch deleted", "Work entry added", "Work entry deleted", "Adjustment created", "Adjustment deleted", "Error"],
  },
  {
    name: "Users",
    purpose: "Controls who can use the workspace.",
    scope: "Team member list, create user, role assignment, branch assignment, activate/deactivate, reset password, custom permissions, remove member.",
    impact: "Protects data and controls what each person can see or change.",
    screens: ["Team", "Create Team Member", "Reset Password", "Permissions", "Remove Team Member"],
    tabs: [],
    buttons: ["Add Member", "Create", "Reset Password", "Save Permissions", "Use role permissions", "Custom permissions", "Deactivate", "Activate", "Remove", "Cancel"],
    toasts: ["User created", "Role updated", "User deactivated", "User activated", "Password reset successful", "Member removed", "User permissions updated", "Error"],
  },
  {
    name: "Roles & Permissions",
    purpose: "Builds reusable access presets.",
    scope: "Role presets, custom groups, module-level access, tab-level control, action permissions, reset role, save permissions.",
    impact: "Makes access management consistent and reduces accidental over-permissioning.",
    screens: ["Roles & Permissions"],
    tabs: [],
    buttons: ["Add custom group", "Reset role", "Save permissions", "Expand/collapse permission groups"],
    toasts: ["Permissions saved", "Error saving permissions"],
  },
  {
    name: "Settings",
    purpose: "Configures the workspace's business identity and operating rules.",
    scope: "Company profile, business tax/locality, preferences, POS printer, units, templates, theme, and tax compliance.",
    impact: "Changes how documents look, how numbers are generated, how tax is calculated, how stock behaves, and how users experience the app.",
    screens: ["Settings"],
    tabs: ["General", "Business", "Preferences", "POS Printer", "Units", "Templates", "Theme", "Tax Compliance"],
    buttons: ["Upload logo", "Save Settings", "Save Preferences", "Save Theme", "Save Printer Settings", "Save Tax Compliance Settings"],
    toasts: ["Settings saved", "Preferences saved", "Theme saved", "Logo updated", "Error saving settings", "Error saving preferences", "Error saving theme", "Error uploading logo"],
  },
  {
    name: "Settings - General",
    purpose: "Stores public company identity.",
    scope: "Company name, phone, email, website, address, city, state, zip, country, and logo.",
    impact: "Appears on invoices, quotations, receipts, and business documents.",
    screens: ["Settings > General"],
    tabs: [],
    buttons: ["Upload logo", "Save Settings"],
    toasts: ["Logo updated", "Settings saved"],
  },
  {
    name: "Settings - Business",
    purpose: "Stores tax, currency, timezone, and fiscal rules.",
    scope: "Tax ID, tax name, tax rate, currency, currency symbol, timezone, date format, fiscal year start.",
    impact: "Affects invoice tax, report periods, currency display, and accounting dates.",
    screens: ["Settings > Business"],
    tabs: [],
    buttons: ["Save Settings"],
    toasts: ["Settings saved", "Error saving settings"],
  },
  {
    name: "Settings - Preferences",
    purpose: "Controls document numbers, stock behavior, and display format.",
    scope: "Invoice, sales order, quotation, purchase order prefixes/suffixes, number length, default templates, low stock threshold, payment method, default tax, SKU prefix, auto SKU, barcode scanning, negative stock, expiry tracking, separators, decimals, and language.",
    impact: "Shapes daily workflows. For example, enabling negative stock allows selling below zero; changing prefixes affects future document numbers.",
    screens: ["Settings > Preferences"],
    tabs: [],
    buttons: ["Save Preferences"],
    toasts: ["Preferences saved", "Error saving preferences"],
  },
  {
    name: "Settings - POS Printer",
    purpose: "Connects Cloud Daftar to a local receipt printer bridge.",
    scope: "Enable bridge, bridge URL, HTTP or raw TCP mode, printer name, paper width, code page, copies, timeout, auto-print receipts, cash drawer, cut paper, auth token.",
    impact: "Controls whether receipts print automatically and how the physical printer behaves at checkout.",
    screens: ["Settings > POS Printer"],
    tabs: [],
    buttons: ["Save Printer Settings"],
    toasts: ["Preferences saved", "Error saving preferences"],
  },
  {
    name: "Invoice Templates",
    purpose: "Controls invoice, quotation, receipt, and label appearance.",
    scope: "Template list, create/edit template, duplicate, delete, set default invoice/thermal/quotation templates, preview and layout settings.",
    impact: "Changes customer-facing documents and printed output.",
    screens: ["Invoice Templates", "Create/Edit Template"],
    tabs: [],
    buttons: ["New Template", "Edit", "Duplicate", "Delete", "Set Default", "Save", "Close"],
    toasts: ["Template created", "Template updated", "Template deleted", "Template duplicated", "Default template updated", "Error saving template", "Error deleting template", "Error duplicating template", "Error setting default"],
  },
  {
    name: "Theme & Branding",
    purpose: "Changes the app's visual style.",
    scope: "Sidebar color, sidebar style, primary color, accent color, font, border radius, layout density, and dark mode.",
    impact: "Improves brand fit and comfort for users without changing business data.",
    screens: ["Settings > Theme", "Admin Branding"],
    tabs: [],
    buttons: ["Save Theme", "Save Branding", "Clear logo", "Clear favicon"],
    toasts: ["Theme saved", "Branding saved", "File too large", "Error saving theme"],
  },
  {
    name: "Tax Compliance",
    purpose: "Configures tax invoice integrations.",
    scope: "Compliance mode None/FBR/ZATCA, FBR username/password/POS ID, ZATCA enable switch, mode local/simulation/production, seller VAT, seller name, branch, CR number, address, device name, OTP, CSR generation, device onboarding, test connection.",
    impact: "Affects tax invoice data and compliance output. Production tax settings should be changed only by authorized finance/admin users.",
    screens: ["Settings > Tax Compliance"],
    tabs: [],
    buttons: ["Generate CSR", "Onboard Device", "Test Connection", "Save Tax Compliance Settings"],
    toasts: ["Tax compliance settings saved", "Settings could not be saved", "ZATCA updated", "ZATCA action failed"],
  },
  {
    name: "Billing & Subscription",
    purpose: "Shows plan, invoices, payments, and auto-renew status.",
    scope: "Current plan, subscription dates, invoice history, payment history, auto-renew settings, upgrade/renew flow where enabled.",
    impact: "Controls whether the workspace remains active and which plan features are available.",
    screens: ["Billing"],
    tabs: [],
    buttons: ["Renew", "Upgrade", "Pay invoice", "Toggle auto-renew"],
    toasts: [],
  },
  {
    name: "Profile",
    purpose: "Lets the current user manage personal details and password.",
    scope: "Name, email display, profile save, current password, new password, confirm password.",
    impact: "Keeps user identity current and protects access through password changes.",
    screens: ["Profile"],
    tabs: [],
    buttons: ["Save profile", "Change password"],
    toasts: ["Profile updated", "Passwords do not match", "Password must be at least 8 characters", "Password changed successfully", "Error saving profile", "Error changing password"],
  },
  {
    name: "Notifications",
    purpose: "Shows system messages and reminders.",
    scope: "Unread/read notifications, mark all as read, notification links, overdue checks.",
    impact: "Keeps users aware of overdue payments, stock issues, subscription notices, and system events.",
    screens: ["Notifications", "Topbar notification menu"],
    tabs: [],
    buttons: ["Open notifications", "Mark all as read", "View notification"],
    toasts: ["All marked as read", "Failed to mark as read", "Could not mark notifications as read"],
  },
  {
    name: "Payment Reminders & Commitments",
    purpose: "Tracks follow-ups and promised payment dates.",
    scope: "Payment reminder list, commitments, follow-up status, linked customers/suppliers/invoices where available.",
    impact: "Improves collection discipline and reduces forgotten follow-ups.",
    screens: ["Payment Reminders & Commitments"],
    tabs: [],
    buttons: ["View", "Follow up", "Mark complete"],
    toasts: [],
  },
  {
    name: "Help & Support",
    purpose: "Gives users support entry points.",
    scope: "Documentation link, chat/support link, support email.",
    impact: "Reduces training friction and gives users a place to ask for help.",
    screens: ["Help & Support"],
    tabs: [],
    buttons: ["View Docs", "Start Chat", "support@clouddaftar.com"],
    toasts: [],
  },
  {
    name: "Super Admin Console",
    purpose: "Lets platform administrators manage the SaaS system.",
    scope: "Admin dashboard, plans, payments, tenants, tenant details, admins, audit log, branding, AI settings, subscription actions, payment approval/rejection.",
    impact: "Affects all tenant companies, subscription access, app branding, and platform-level administration.",
    screens: ["Admin Login", "Admin Dashboard", "Plans", "Payments", "Tenants", "Tenant Detail", "Admins", "Admin Audit", "Admin Settings"],
    tabs: ["Payments: Pending, All Payments"],
    buttons: ["Add Plan", "Edit plan", "Confirm payment", "Reject payment", "View payment", "Delete payment", "Search tenant", "Suspend", "Reactivate", "Extend Subscription", "Change Plan", "Add Admin", "Activate/Deactivate Admin", "Save Branding", "Save AI settings"],
    toasts: ["Plan created", "Plan updated", "Payment confirmed", "Payment rejected", "Invoice deleted", "Admin created", "Admin updated", "Admin activated", "Admin deactivated", "Branding saved", "AI settings saved", "Success", "Error"],
  },
];

const commonControls = [
  ["Search box", "Type part of a name, number, SKU, barcode, invoice, customer, supplier, or setting to narrow the list."],
  ["Add/New button", "Opens a form to create a record. The record is not saved until Save/Create/Submit is clicked."],
  ["Edit button", "Opens an existing record so allowed fields can be changed."],
  ["Delete/Remove button", "Removes or deactivates a record. Use carefully because some records affect reports and history."],
  ["Save/Create/Submit button", "Checks the form and stores the information."],
  ["Cancel/Close button", "Leaves the dialog without saving current unsaved changes."],
  ["Export CSV/Excel", "Downloads table data so it can be opened in Excel or shared with an accountant."],
  ["Print/PDF", "Creates a printable document for customers, suppliers, or internal records."],
  ["Filter button", "Applies selected dates, status, product, customer, supplier, or type filters."],
  ["Previous/Next page", "Moves through long lists without loading everything at once."],
  ["Switch/toggle", "Turns a setting on or off."],
  ["Select/dropdown", "Lets the user choose one value from a list."],
  ["Tabs", "Divide one module into related sub-sections without leaving the screen."],
  ["Dialog/modal", "A smaller window for quick create, edit, confirmation, or detail work."],
  ["Toast message", "A temporary popup showing success, warning, or error after an action."],
];

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function list(items) {
  if (!items || items.length === 0) return "<p class=\"muted\">None on this screen.</p>";
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function moduleSection(m) {
  return `
    <section class="module">
      <h2>${esc(m.name)}</h2>
      <div class="triad">
        <div><h3>Purpose</h3><p>${esc(m.purpose)}</p></div>
        <div><h3>Scope</h3><p>${esc(m.scope)}</p></div>
        <div><h3>Impact</h3><p>${esc(m.impact)}</p></div>
      </div>
      <div class="grid2">
        <div><h3>Screens Covered</h3>${list(m.screens)}</div>
        <div><h3>Tabs</h3>${list(m.tabs)}</div>
        <div><h3>Main Buttons / Actions</h3>${list(m.buttons)}</div>
        <div><h3>Toast Messages / Alerts</h3>${list(m.toasts)}</div>
      </div>
    </section>`;
}

function screenshotSection() {
  const screenshots = screenshotManifest.screenshots || [];
  if (screenshots.length === 0) {
    return `
      <section>
        <h2>Screen Examples</h2>
        <p class="muted">No screenshots were captured yet. Run scripts/capture-manual-screenshots.js and regenerate this manual to include them.</p>
      </section>`;
  }

  return `
    <section>
      <h2>Screen Examples</h2>
      <p>These screenshots show the actual Cloud Daftar interface from the demo workspace. They help users match this manual with what they see on screen.</p>
      <div class="screenshots">
        ${screenshots
          .map(
            (shot) => `
              <figure>
                <img src="${esc(shot.file)}" alt="${esc(shot.title)} screenshot" />
                <figcaption>${esc(shot.title)}</figcaption>
              </figure>`,
          )
          .join("")}
      </div>
    </section>`;
}

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Cloud Daftar User Manual</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font-family: Arial, Helvetica, sans-serif; line-height: 1.45; background: white; }
    .cover { min-height: 92vh; display: flex; flex-direction: column; justify-content: center; border-bottom: 5px solid #714b67; }
    .brand { color: #714b67; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; font-size: 13px; }
    h1 { font-size: 42px; line-height: 1.08; margin: 14px 0 12px; color: #111827; }
    .subtitle { font-size: 18px; max-width: 720px; color: #4b5563; }
    .meta { margin-top: 42px; color: #4b5563; font-size: 13px; }
    h2 { color: #111827; font-size: 24px; margin: 0 0 12px; page-break-after: avoid; }
    h3 { color: #273244; font-size: 13px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: .04em; }
    p { margin: 0 0 9px; }
    section { page-break-inside: avoid; margin: 0 0 18px; padding: 0 0 12px; border-bottom: 1px solid #e5e7eb; }
    .module { padding-top: 10px; }
    .triad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }
    .triad > div, .grid2 > div, .note, table { border: 1px solid #d8dee9; border-radius: 8px; padding: 10px; background: #fbfcfe; }
    .grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 2px 0; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; padding: 0; }
    th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    th { background: #eef2f7; color: #111827; }
    tr:last-child td { border-bottom: 0; }
    .muted { color: #6b7280; font-style: italic; }
    .toc { columns: 2; column-gap: 30px; }
    .toc li { break-inside: avoid; margin-bottom: 5px; }
    .small { font-size: 12px; color: #4b5563; }
    .screenshots { display: grid; grid-template-columns: 1fr; gap: 14px; }
    figure { margin: 0; page-break-inside: avoid; border: 1px solid #d8dee9; border-radius: 8px; overflow: hidden; background: #ffffff; }
    figure img { display: block; width: 100%; height: auto; max-height: 165mm; object-fit: contain; object-position: top left; }
    figcaption { padding: 7px 10px; border-top: 1px solid #e5e7eb; color: #374151; font-size: 12px; font-weight: 700; background: #f8fafc; }
    .pagebreak { page-break-before: always; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="brand">Cloud Daftar</div>
    <h1>User Manual</h1>
    <p class="subtitle">A layman-language guide for every major screen, module, tab, button type, toast message, dashboard, setting, and administration area.</p>
    <div class="meta">
      <p><strong>Generated:</strong> ${new Date().toLocaleDateString("en-GB")}</p>
      <p><strong>Audience:</strong> Business owners, cashiers, accountants, managers, staff users, and platform admins.</p>
      <p><strong>Note:</strong> Some screens appear only when the user's role, permissions, plan, or tenant route allows them.</p>
    </div>
  </div>

  <section>
    <h2>How To Read This Manual</h2>
    <p>This manual explains Cloud Daftar in simple business language. Each module includes purpose, scope, and impact.</p>
    <table>
      <tr><th>Term</th><th>Meaning</th></tr>
      <tr><td>Purpose</td><td>Why this screen exists.</td></tr>
      <tr><td>Scope</td><td>What this screen or module can handle.</td></tr>
      <tr><td>Impact</td><td>What changes in the business when a user works here.</td></tr>
      <tr><td>Toast</td><td>A small message that appears after an action, such as saved successfully or failed.</td></tr>
      <tr><td>Permission</td><td>A rule that decides whether a user can view, create, edit, delete, approve, export, or manage something.</td></tr>
    </table>
  </section>

  <section>
    <h2>Navigation Map</h2>
    <p>The sidebar groups the system into business areas. The top bar also provides search, notifications, theme, profile, settings, billing, and sign out shortcuts.</p>
    <table>
      <tr><th>Sidebar Group</th><th>Screens</th></tr>
      ${navGroups.map(([group, screens]) => `<tr><td>${esc(group)}</td><td>${esc(screens)}</td></tr>`).join("")}
    </table>
  </section>

  <section>
    <h2>Common Buttons And Controls</h2>
    <table>
      <tr><th>Control</th><th>Layman Explanation</th></tr>
      ${commonControls.map(([control, meaning]) => `<tr><td>${esc(control)}</td><td>${esc(meaning)}</td></tr>`).join("")}
    </table>
  </section>

  <section>
    <h2>Common Toast Types</h2>
    <table>
      <tr><th>Toast Type</th><th>Meaning</th><th>What To Do</th></tr>
      <tr><td>Success</td><td>The action worked.</td><td>Continue with the next task.</td></tr>
      <tr><td>Error</td><td>The action failed or required information is missing.</td><td>Read the message, correct the form, check permissions, or try again.</td></tr>
      <tr><td>Warning/Disabled button</td><td>The action is not available yet.</td><td>Complete required fields, select records, or ask an admin for permission.</td></tr>
      <tr><td>Loading/Saving</td><td>The system is working.</td><td>Wait until the button becomes active again.</td></tr>
    </table>
  </section>

  <div class="pagebreak"></div>
  <section>
    <h2>Table Of Contents</h2>
    <ol class="toc">
      ${modules.map((m) => `<li>${esc(m.name)}</li>`).join("")}
    </ol>
  </section>

  <div class="pagebreak"></div>
  ${screenshotSection()}

  <div class="pagebreak"></div>
  ${modules.map(moduleSection).join("\n")}

  <section>
    <h2>Permission Impact Summary</h2>
    <p>Cloud Daftar uses permissions so every user sees only what they need. Owners normally have full access. Admins and managers may have broad access. Staff and cashiers usually have limited access for daily operations.</p>
    <table>
      <tr><th>Permission Area</th><th>What It Controls</th><th>Business Impact</th></tr>
      <tr><td>Dashboard</td><td>Viewing summary metrics.</td><td>Lets users monitor the business without changing data.</td></tr>
      <tr><td>Inventory</td><td>Products, stock, categories, adjustments, deletes.</td><td>Affects what can be sold and reported as available.</td></tr>
      <tr><td>Sales</td><td>Invoices, POS, returns, edits, deletes.</td><td>Affects revenue, customer balances, stock, and tax records.</td></tr>
      <tr><td>Purchases</td><td>Supplier bills, purchase orders, approvals, drafts.</td><td>Affects inventory cost and supplier balances.</td></tr>
      <tr><td>Customers/Suppliers</td><td>Contact creation, editing, and deletion.</td><td>Affects invoices, purchases, payments, and statements.</td></tr>
      <tr><td>Reports</td><td>Viewing and exporting reports.</td><td>Controls who can see sensitive business performance data.</td></tr>
      <tr><td>Accounting</td><td>Receivables, payables, reconciliation, reports, journals.</td><td>Affects financial records and accountant review.</td></tr>
      <tr><td>Expenses</td><td>Submitting and approving expenses.</td><td>Affects reimbursements and company costs.</td></tr>
      <tr><td>Employees/Payroll</td><td>HR records, contracts, payslips, batches.</td><td>Affects employee data and salary workflows.</td></tr>
      <tr><td>Users/Settings/Billing</td><td>Team access, workspace setup, subscription.</td><td>Affects security, document behavior, branding, and plan access.</td></tr>
    </table>
  </section>
</body>
</html>`;

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(htmlPath, html, "utf8");
  const browserPaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const executablePath = browserPaths.find((candidate) => fs.existsSync(candidate));
  const browser = await puppeteer.launch({
    headless: "new",
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle0" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;color:#6b7280;">Cloud Daftar User Manual</div>`,
    footerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;color:#6b7280;text-align:right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
    margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
  });
  await browser.close();
  console.log(`Wrote ${pdfPath}`);
  console.log(`Wrote ${htmlPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
