import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

export async function launchPdfBrowser() {
  const isVercel =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

  if (isVercel) {
    const chromiumPackUrl = process.env.CHROMIUM_PACK_URL;

    if (!chromiumPackUrl) {
      throw new Error("Missing CHROMIUM_PACK_URL environment variable");
    }

    const executablePath = await chromium.executablePath(chromiumPackUrl);

    return puppeteerCore.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--hide-scrollbars",
      ],
      defaultViewport: {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
      },
      executablePath,
      headless: true,
    });
  }

  const puppeteer = await import("puppeteer");

  return puppeteer.default.launch({
    headless: true,
  });
}