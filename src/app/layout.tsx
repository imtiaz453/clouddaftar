import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

const getBranding = unstable_cache(
  async () => {
    try {
      const rows = await prisma.systemSetting.findMany({
        where: { key: { in: ["appName", "faviconUrl"] } },
      });
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return { appName: map.appName || "Cloud Daftar", faviconUrl: map.faviconUrl || "" };
    } catch {
      return { appName: "Cloud Daftar", faviconUrl: "" };
    }
  },
  ["app-branding"],
  { revalidate: 300 },
);

export async function generateMetadata(): Promise<Metadata> {
  const { appName } = await getBranding();
  return {
    title: `${appName} - Modern ERP System`,
    description: `${appName} is a modern multi-tenant ERP SaaS platform.`,
    keywords: ["ERP", "SaaS", "Inventory", "Invoicing", "Business Management"],
    manifest: "/manifest.json",
    icons: {
      icon: "/favicon.ico",
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563eb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1625" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { faviconUrl } = await getBranding();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {faviconUrl ? (
          <link rel="icon" href={faviconUrl} />
        ) : (
          <>
            <link rel="icon" href="/favicon.ico" sizes="any" />
            <link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png" />
            <link rel="icon" href="/icons/icon-512.png" sizes="512x512" type="image/png" />
          </>
        )}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Cloud Daftar" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=['bis_skin_checked','__processed_','bis_register'];var d=document;var n=d.querySelectorAll('['+a[0]+'],['+a[1]+'],['+a[2]+']');for(var i=0;i<n.length;i++){for(var j=0;j<a.length;j++){n[i].removeAttribute(a[j])}}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
