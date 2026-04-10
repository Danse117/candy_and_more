// app/page.tsx
"use client";

import { useState } from "react";
import { products, getCategories, getCategoryCounts, searchProducts } from "@/lib/products";
import Navbar from "@/components/custom/navbar";
import CategoryBar from "@/components/custom/category-bar";
import ProductGrid from "@/components/custom/product-grid";
import InquiryBanner from "@/components/custom/inquiry-banner";
import CartDrawer from "@/components/custom/cart-drawer";
import Footer from "@/components/custom/footer";

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  const categories = getCategories();
  const categoryCounts = getCategoryCounts();
  const filteredProducts = searchProducts(searchQuery, activeCategory);

  function handleSearchChange(query: string) {
    setSearchQuery(query);
    setVisibleCount(20);
  }

  function handleCategoryChange(category: string) {
    setActiveCategory(category);
    setVisibleCount(20);
  }

  return (
    <>
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onCartClick={() => setCartOpen(true)}
      />

      <main className="mx-auto max-w-[1180px] px-4 min-w-0 w-full">
        {/* Hero */}
        <div className="pt-2.5">
          <h2 className="my-2 text-[22px] font-black">Wholesale Catalog</h2>
          <p className="m-0 text-[var(--candy-muted)] leading-snug">
            Browse our full selection by category. Search by name, description, or UPC.
          </p>
        </div>

        {/* Category filter */}
        <CategoryBar
          categories={categories}
          categoryCounts={categoryCounts}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          totalProducts={products.length}
        />

        {/* Inquiry banner */}
        <InquiryBanner />

        {/* Product grid */}
        <ProductGrid
          products={filteredProducts}
          visibleCount={visibleCount}
          onLoadMore={() => setVisibleCount((c) => c + 20)}
        />
      </main>

      <Footer />

      {/* Cart drawer */}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
