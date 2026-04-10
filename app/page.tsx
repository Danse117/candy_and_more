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

  const categories = getCategories();
  const categoryCounts = getCategoryCounts();
  const filteredProducts = searchProducts(searchQuery, activeCategory);

  return (
    <>
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCartClick={() => setCartOpen(true)}
      />

      <main className="mx-auto max-w-[1180px] px-4">
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
          onCategoryChange={setActiveCategory}
          totalProducts={products.length}
        />

        {/* Inquiry banner */}
        <InquiryBanner />

        {/* Product grid */}
        <ProductGrid products={filteredProducts} />
      </main>

      <Footer />

      {/* Cart drawer */}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
