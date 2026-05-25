import { requireCompanyAuth } from "@/lib/auth-helper";
import { getCategories } from "@/actions/inventory";
import { prisma } from "@/lib/prisma";
import { CategoriesClient } from "@/features/inventory/categories/categories-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function CategoriesPage() {
  await requireCompanyAuth();
  const categories = await getCategories().catch(() => []);
  const catsWithCounts = await Promise.all(
    categories.map(async (cat) => {
      const count = await prisma.product.count({ where: { categoryId: cat.id, deletedAt: null } });
      return { ...cat, _count: { products: count } };
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="Manage product categories" />
      <CategoriesClient categories={catsWithCounts as any} />
    </div>
  );
}
