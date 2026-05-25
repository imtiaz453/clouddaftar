"use client";

import { BookOpen, Download, ExternalLink, HelpCircle, Mail, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    q: "How do I create a new sale?",
    a: "Go to Sales > POS / New Sale or use the Sales Invoices page to create invoices.",
  },
  {
    q: "How do I manage inventory?",
    a: "Use the Inventory module under Products. You can add, edit, adjust stock, and track low stock alerts.",
  },
  {
    q: "How do I record a purchase?",
    a: "Navigate to Purchases > Purchases to record new purchases or create purchase orders.",
  },
  {
    q: "How do I generate reports?",
    a: "Accounting Reports and various dashboard pages provide financial and operational insights.",
  },
  {
    q: "How do I invite users?",
    a: "Go to Administration > Users to invite team members and assign roles.",
  },
  {
    q: "How do I customize the theme?",
    a: "Go to Settings > Theme & Branding to customize colors and appearance.",
  },
];

export function HelpContent() {
  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Complete User Manual</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open the layman-language PDF guide for every screen, module, tab, button, toast,
                  dashboard, setting, purpose, scope, and impact.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild size="sm">
                <a
                  href="/manuals/cloud-daftar-user-manual-with-screenshots.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open PDF
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="/manuals/cloud-daftar-user-manual-with-screenshots.pdf" download>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-sm">Documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Comprehensive guides and documentation for all features.
            </p>
            <Button variant="link" className="mt-2 h-auto px-0 text-xs" asChild>
              <a href="/manuals/cloud-daftar-user-manual.html" target="_blank" rel="noreferrer">
                View Docs -&gt;
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <CardTitle className="text-sm">Live Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Chat with our support team in real-time.</p>
            <Button variant="link" className="mt-2 h-auto px-0 text-xs">
              Start Chat -&gt;
            </Button>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Mail className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-sm">Email Support</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Send us an email and we&apos;ll get back to you within 24 hours.
            </p>
            <Button variant="link" className="mt-2 h-auto px-0 text-xs">
              support@clouddaftar.com -&gt;
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b pb-3 last:border-0 last:pb-0">
              <p className="flex items-start gap-2 text-sm font-medium">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                {faq.q}
              </p>
              <p className="ml-6 mt-1 text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
