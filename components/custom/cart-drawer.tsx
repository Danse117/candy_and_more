// components/custom/cart-drawer.tsx
"use client";

import { X } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { getProductById } from "@/lib/products";
import { Button } from "@/components/ui/button";
import CartItemRow from "./cart-item-row";
import Link from "next/link";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, clearCart, totalItems } = useCart();

  const cartProducts = Array.from(items.entries())
    .map(([id, qty]) => ({ product: getProductById(id), quantity: qty }))
    .filter((item): item is { product: NonNullable<typeof item.product>; quantity: number } =>
      item.product !== undefined
    );

  const totalPrice = cartProducts.reduce(
    (sum, { product, quantity }) => sum + product.price * quantity,
    0
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[rgba(15,23,42,0.35)] flex items-stretch justify-end z-50 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(460px,92vw)] bg-[rgba(248,250,252,0.98)] border-l border-[var(--candy-border)] p-3.5 flex flex-col gap-2.5 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-2.5">
          <h3 className="text-base font-black m-0">Your Cart</h3>
          <Button variant="outline" size="icon-sm" onClick={onClose} className="rounded-[14px]">
            <X className="size-4" />
          </Button>
        </div>

        {/* Items */}
        <div className="overflow-auto border border-[var(--candy-border)] rounded-[18px] bg-white p-2.5 min-h-[180px] max-h-[48vh] shadow-sm">
          {cartProducts.length === 0 ? (
            <div className="text-[var(--candy-muted)] p-4 text-center">
              Your cart is empty.
            </div>
          ) : (
            cartProducts.map(({ product, quantity }) => (
              <CartItemRow key={product.id} product={product} quantity={quantity} />
            ))
          )}
        </div>

        {/* Totals */}
        <div className="border border-[var(--candy-border)] rounded-[18px] p-3 bg-white shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-center text-[var(--candy-muted)] text-[13px]">
            <span>Items</span>
            <b className="text-[var(--candy-text)]">{totalItems}</b>
          </div>
          <div className="flex justify-between items-center text-[var(--candy-muted)] text-[13px]">
            <span>Estimated total</span>
            <b className="text-[var(--candy-text)]">${totalPrice.toFixed(2)}</b>
          </div>

          <div className="flex gap-2.5 mt-2">
            <button
              onClick={clearCart}
              className="rounded-2xl py-3 px-3 cursor-pointer bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.30)] text-[#7F1D1D] font-black min-w-[120px] transition-colors hover:bg-[rgba(239,68,68,0.20)]"
            >
              Clear
            </button>
            <Link
              href="/cart"
              onClick={onClose}
              className="flex-1 rounded-2xl py-3 px-3 cursor-pointer bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)] text-center no-underline"
            >
              Checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
