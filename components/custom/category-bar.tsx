"use client";

const CATEGORY_ICONS: Record<string, string> = {
  All: "📦",
  "Gummies & Chewy Candy": "🍬",
  "Cookies & Wafers": "🍪",
  "Chips & Snacks": "🍟",
  "Chocolate Bars": "🍫",
  "Gum & Mints": "🍃",
  "Protein & Energy Bars": "💪",
  "Noodles & Soups": "🍜",
  "Rolling Papers": "📜",
  "Fragrances & Candles": "🕯️",
};

interface CategoryBarProps {
  categories: string[];
  categoryCounts: Record<string, number>;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  totalProducts: number;
}

export default function CategoryBar({
  categories,
  categoryCounts,
  activeCategory,
  onCategoryChange,
  totalProducts,
}: CategoryBarProps) {
  return (
    <div className="flex gap-2 py-3.5 overflow-x-auto scrollbar-none">
      {/* All button */}
      <button
        onClick={() => onCategoryChange("All")}
        className={`shrink-0 border rounded-xl px-3.5 py-2 text-[13px] font-bold cursor-pointer transition-all whitespace-nowrap shadow-sm ${
          activeCategory === "All"
            ? "bg-[var(--candy-accent)] border-[var(--candy-accent)] text-white shadow-[0_4px_16px_rgba(96,165,250,0.3)]"
            : "bg-white border-[var(--candy-border)] text-[var(--candy-muted)] hover:border-[var(--candy-accent)] hover:text-[var(--candy-text)]"
        }`}
      >
        📦 All <span className="ml-1.5 text-[11px] opacity-70">{totalProducts}</span>
      </button>

      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onCategoryChange(cat)}
          className={`shrink-0 border rounded-xl px-3.5 py-2 text-[13px] font-bold cursor-pointer transition-all whitespace-nowrap shadow-sm ${
            activeCategory === cat
              ? "bg-[var(--candy-accent)] border-[var(--candy-accent)] text-white shadow-[0_4px_16px_rgba(96,165,250,0.3)]"
              : "bg-white border-[var(--candy-border)] text-[var(--candy-muted)] hover:border-[var(--candy-accent)] hover:text-[var(--candy-text)]"
          }`}
        >
          {CATEGORY_ICONS[cat] || "📦"} {cat}{" "}
          <span className="ml-1.5 text-[11px] opacity-70">{categoryCounts[cat] || 0}</span>
        </button>
      ))}
    </div>
  );
}
