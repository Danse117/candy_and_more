"use client";

import { useEffect, useState } from "react";
import { Package, ShoppingCart } from "lucide-react";

interface Stats {
  productCount: number;
  orderCount: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ productCount: 0, orderCount: 0 });

  useEffect(() => {
    const token = sessionStorage.getItem("nf_token");
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch("/api/admin/products", { headers }).then((r) => r.json()),
      fetch("/api/admin/orders", { headers }).then((r) => r.json()),
    ]).then(([products, orders]) => {
      setStats({
        productCount: Array.isArray(products) ? products.length : 0,
        orderCount: Array.isArray(orders) ? orders.length : 0,
      });
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-black mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Package className="size-5 text-[var(--candy-accent)]" />
            <span className="text-sm font-bold text-[var(--candy-muted)]">Products</span>
          </div>
          <div className="text-3xl font-black">{stats.productCount}</div>
        </div>
        <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="size-5 text-[var(--candy-green)]" />
            <span className="text-sm font-bold text-[var(--candy-muted)]">Orders</span>
          </div>
          <div className="text-3xl font-black">{stats.orderCount}</div>
        </div>
      </div>
    </div>
  );
}
