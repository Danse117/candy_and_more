// app/page.tsx — async server component
import { getProducts, getCategories, getCategoryCounts } from "@/lib/products";
import CatalogClient from "@/components/custom/catalog-client";

export default async function CatalogPage() {
  const [products, categories, categoryCounts] = await Promise.all([
    getProducts(),
    getCategories(),
    getCategoryCounts(),
  ]);

  return (
    <CatalogClient
      products={products}
      categories={categories}
      categoryCounts={categoryCounts}
    />
  );
}
