const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const baseUrl = process.env.MANUAL_SCREENSHOT_BASE_URL || "http://localhost:3001";
const outDir = path.join(__dirname, "..", "docs", "manual-screenshots");

const browserPaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const shots = [
  { name: "apps", title: "Apps Launchpad", path: "/demo-pharmacy/apps" },
  { name: "dashboard", title: "Dashboard", path: "/demo-pharmacy" },
  { name: "pos-register", title: "POS Register", path: "/demo-pharmacy/sales/new" },
  { name: "sales", title: "Sales Invoices", path: "/demo-pharmacy/sales" },
  { name: "inventory", title: "Inventory", path: "/demo-pharmacy/inventory" },
  { name: "reports", title: "Reports", path: "/demo-pharmacy/reports" },
  { name: "settings", title: "Settings", path: "/demo-pharmacy/settings" },
  { name: "help", title: "Help & Support With Manual", path: "/demo-pharmacy/help" },
];

async function screenshot(page, name, targetPath) {
  await page.goto(`${baseUrl}${targetPath}`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    fullPage: false,
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const executablePath = browserPaths.find((candidate) => fs.existsSync(candidate));
  const browser = await puppeteer.launch({
    headless: "new",
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.screenshot({ path: path.join(outDir, "login.png"), fullPage: false });
  await page.locator('input[type="email"]').fill("admin@clouddaftar.com");
  await page.locator('input[type="password"]').fill("password123");
  await Promise.all([
    page.locator('button[type="submit"]').click(),
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }).catch(() => null),
  ]);
  await page.waitForFunction(
    () => !location.pathname.includes("login"),
    { timeout: 60000 },
  );

  const manifest = [{ name: "login", title: "Login", file: "manual-screenshots/login.png" }];
  for (const shot of shots) {
    await screenshot(page, shot.name, shot.path);
    manifest.push({
      name: shot.name,
      title: shot.title,
      file: `manual-screenshots/${shot.name}.png`,
    });
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), screenshots: manifest }, null, 2),
    "utf8",
  );
  await browser.close();
  console.log(`Captured ${manifest.length} screenshots in ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
