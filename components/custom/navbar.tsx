"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import SearchInput from "./search-input";

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCartClick: () => void;
}

export default function Navbar({ searchQuery, onSearchChange, onCartClick }: NavbarProps) {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--candy-border)] bg-[rgba(248,250,252,0.78)] backdrop-blur-[10px]">
      <div className="mx-auto max-w-[1180px] px-4 py-4">
        <div className="flex items-center justify-between gap-3.5 flex-wrap">
          <div className="text-2xl font-black tracking-tight">
            Candy <span className="text-[var(--candy-accent)]">&</span> More
          </div>
          <div className="flex items-center gap-2.5 flex-1 justify-end min-w-[280px]">
            <SearchInput value={searchQuery} onChange={onSearchChange} />
            <Button
              variant="outline"
              onClick={onCartClick}
              className="rounded-2xl px-3.5 py-3 h-auto font-extrabold shadow-sm border-[var(--candy-border)]"
            >
              <ShoppingCart className="size-4" />
              Cart
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black">
                {totalItems}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
