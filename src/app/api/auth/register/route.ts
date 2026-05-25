import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { getLocalityPreset } from "@/lib/locality";
import { registerSchema } from "@/lib/validations";
import { addDays, STARTER_PLAN_CODE, STARTER_TRIAL_DAYS } from "@/lib/subscription-policy";

export async function POST(req: Request) {
  try {
    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter valid registration details" },
        { status: 400 },
      );
    }

    const { name, email, password, companyName, country } = parsed.data;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedCompanyName = typeof companyName === "string" ? companyName.trim() : "";
    const locality = getLocalityPreset(country);

    if (!normalizedName || !normalizedEmail || !password || !normalizedCompanyName) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    const existingCompany = await prisma.company.findFirst({
      where: { name: { equals: normalizedCompanyName, mode: "insensitive" }, deletedAt: null },
    });
    if (existingCompany) {
      return NextResponse.json(
        { error: `A workspace with the name "${normalizedCompanyName}" already exists. Please use a different name.` },
        { status: 409 },
      );
    }

    const slug = slugify(normalizedCompanyName) + "-" + Math.random().toString(36).slice(2, 6);

    const passwordHash = await hashPassword(password);
    const starterPlan = await prisma.subscriptionPlan.findUnique({
      where: { code: STARTER_PLAN_CODE },
      select: { id: true },
    });
    if (!starterPlan) {
      return NextResponse.json(
        { error: "Starter plan is not configured. Please contact support." },
        { status: 500 },
      );
    }
    const now = new Date();
    const trialEnd = addDays(now, STARTER_TRIAL_DAYS);

    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
        companies: {
          create: {
            role: "OWNER",
            company: {
              create: {
                name: normalizedCompanyName,
                slug,
                country: locality.country,
                taxName: locality.taxName,
                taxRate: locality.taxRate,
                currency: locality.currency,
                currencySymbol: locality.currencySymbol,
                timezone: locality.timezone,
                settings: {
                  create: {
                    invoicePrefix: "INV-",
                    salesOrderPrefix: "SORD-",
                    proformaInvoicePrefix: "PI-",
                    quotationPrefix: "QUOT-",
                    purchaseOrderPrefix: "PO-",
                    invoiceNumberLength: 5,
                    autoGenerateSKU: true,
                    skuPrefix: slugify(normalizedCompanyName).slice(0, 3).toUpperCase(),
                    defaultTaxRate: locality.defaultTaxRate,
                    taxComplianceMode: locality.taxComplianceMode,
                  },
                },
                theme: {
                  create: {},
                },
                subscription: {
                  create: {
                    planId: starterPlan.id,
                    status: "TRIAL",
                    billingCycle: "MONTHLY",
                    startDate: now,
                    endDate: trialEnd,
                    trialEndDate: trialEnd,
                    autoRenew: false,
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        companies: {
          select: { companyId: true, company: { select: { slug: true } } },
          take: 1,
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        companyId: user.companies[0].companyId,
        action: "COMPANY_CREATED",
        details: `Company "${normalizedCompanyName}" created by ${normalizedName}`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        companySlug: user.companies[0].company.slug,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
