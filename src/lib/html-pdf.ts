import { launchPdfBrowser } from "@/lib/pdf/browser";
import type { PDFOptions } from "puppeteer-core";
import type { PaperSize } from "@/lib/template-registry";

let browserInstance: Awaited<ReturnType<typeof launchPdfBrowser>> | null = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await launchPdfBrowser();
  }
  return browserInstance;
}

function paperSizeToFormat(size: PaperSize): PDFOptions {
  switch (size) {
    case "THERMAL_58":
      return { width: "58mm" };
    case "THERMAL_80":
      return { width: "80mm" };
    default:
      return { format: "A4" };
  }
}

function withBaseUrl(html: string, baseUrl?: string): string {
  if (!baseUrl) return html;

  const href = new URL("/", baseUrl).toString();
  const baseTag = `<base href="${href}">`;
  if (/<base\s/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  return `${baseTag}${html}`;
}

export async function generatePdfFromHtml(
  html: string,
  paperSize: PaperSize = "A4",
  baseUrl?: string,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.emulateMediaType("print");
    await page.setContent(withBaseUrl(html, baseUrl), {
      waitUntil: ["load", "domcontentloaded"],
      timeout: 30000,
    });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});

    await page.evaluate(async () => {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(document.images, (img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          });
        }),
      );
    });

    const size = paperSizeToFormat(paperSize);

    const pdf = await page.pdf({
      ...size,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
