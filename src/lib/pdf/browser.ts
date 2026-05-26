import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

export async function launchPdfBrowser() {
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

  if (isProduction) {
    return puppeteerCore.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const puppeteer = await import("puppeteer");
  return puppeteer.default.launch({
    headless: true,
  });
}
