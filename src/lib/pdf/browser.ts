import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";

export async function launchPdfBrowser() {
  const isVercel =
    !!process.env.VERCEL || process.env.NODE_ENV === "production";

  if (isVercel) {
    return puppeteerCore.launch({
      args: [
        ...chromium.args,
        "--hide-scrollbars",
        "--disable-web-security",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const puppeteer = await import("puppeteer-core");
  return puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}
