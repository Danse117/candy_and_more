"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { Product } from "./types";

interface CartContextValue {
  items: Map<string, number>;
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  products: Product[];
  getProductById: (id: string) => Product | undefined;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  products,
  children,
}: {
  products: Product[];
  children: ReactNode;
}) {
  const [items, setItems] = useState<Map<string, number>>(new Map());

  const addItem = useCallback((productId: string) => {
    setItems((prev) => {
      const next = new Map(prev);
      next.set(productId, (next.get(productId) || 0) + 1);
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => {
      const next = new Map(prev);
      const qty = next.get(productId) || 0;
      if (qty <= 1) next.delete(productId);
      else next.set(productId, qty - 1);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      const next = new Map(prev);
      if (quantity <= 0) next.delete(productId);
      else next.set(productId, quantity);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems(new Map());
  }, []);

  const totalItems = Array.from(items.values()).reduce((a, b) => a + b, 0);

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const getProductById = useCallback(
    (id: string) => productMap.get(id),
    [productMap]
  );

  return (
    <CartContext
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        products,
        getProductById,
      }}
    >
      {children}
    </CartContext>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
