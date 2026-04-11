"use client";

import { useEffect, useState } from "react";

interface Order {
  id: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  note: string | null;
  items: string; // JSON string
  totalPrice: string;
  submittedAt: string;
  createdAt: string;
}

interface OrderItem {
  productId: string;
  name: string;
  upc: string;
  quantity: number;
  price: number;
}

interface ProductSummary {
  id: string;
  photoUrl: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [photoByProductId, setPhotoByProductId] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("nf_token");
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch("/api/admin/orders", { headers }).then((r) => r.json()),
      fetch("/api/admin/products", { headers }).then((r) => r.json()),
    ]).then(([ordersData, productsData]) => {
      if (Array.isArray(ordersData)) setOrders(ordersData);
      if (Array.isArray(productsData)) {
        const map: Record<string, string> = {};
        for (const p of productsData as ProductSummary[]) {
          map[p.id] = p.photoUrl;
        }
        setPhotoByProductId(map);
      }
    });
  }, []);

  function formatDate(raw: string | null | undefined): string {
    if (!raw) return "—";
    const d = new Date(raw);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  }

  function formatPrice(raw: string | number | null | undefined): string {
    const n = Number(raw);
    return isNaN(n) ? "0.00" : n.toFixed(2);
  }

  return (
    <div>
      <h1 className="text-2xl font-black mb-6">Orders</h1>

      {orders.length === 0 ? (
        <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-8 text-center text-[var(--candy-muted)] shadow-sm">
          No orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            let items: OrderItem[] = [];
            try {
              items = JSON.parse(order.items);
            } catch {
              items = [];
            }
            const isExpanded = expanded === order.id;
            const submittedDate = formatDate(order.submittedAt || order.createdAt);

            return (
              <div
                key={order.id}
                className="bg-white border border-[var(--candy-border)] rounded-[18px] shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm">
                      {order.customerFirstName} {order.customerLastName}
                    </div>
                    <div className="text-xs text-[var(--candy-muted)] truncate">
                      {order.customerEmail} &bull; {submittedDate}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-black text-[#16A34A]">
                      ${formatPrice(order.totalPrice)}
                    </div>
                    <div className="text-xs text-[var(--candy-muted)]">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[var(--candy-border)] p-4">
                    {order.note && (
                      <p className="text-sm text-[var(--candy-muted)] mb-3 italic">
                        Note: {order.note}
                      </p>
                    )}

                    {/* Desktop table */}
                    <table className="hidden sm:table w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--candy-muted)]">
                          <th className="pb-2 font-bold text-xs">Product</th>
                          <th className="pb-2 font-bold text-xs">UPC</th>
                          <th className="pb-2 font-bold text-xs text-center">Qty</th>
                          <th className="pb-2 font-bold text-xs text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => {
                          const photo = photoByProductId[item.productId];
                          return (
                            <tr key={i} className="border-t border-[rgba(226,232,240,0.5)]">
                              <td className="py-2 pr-2">
                                <div className="flex items-center gap-3">
                                  {photo && photo !== "MISSING" ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={photo}
                                      alt={item.name}
                                      className="size-10 rounded-lg object-cover border border-[var(--candy-border)] shrink-0"
                                    />
                                  ) : (
                                    <div className="size-10 rounded-lg bg-[#F1F5F9] border border-[var(--candy-border)] shrink-0" />
                                  )}
                                  <span className="min-w-0">{item.name}</span>
                                </div>
                              </td>
                              <td className="py-2 font-mono text-xs text-[var(--candy-muted)]">
                                {item.upc}
                              </td>
                              <td className="py-2 text-center">{item.quantity}</td>
                              <td className="py-2 text-right font-bold">
                                ${(Number(item.price) * item.quantity).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Mobile stacked items */}
                    <div className="sm:hidden space-y-2.5">
                      {items.map((item, i) => {
                        const photo = photoByProductId[item.productId];
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-3 py-2 border-t border-[rgba(226,232,240,0.5)] first:border-t-0"
                          >
                            {photo && photo !== "MISSING" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photo}
                                alt={item.name}
                                className="size-12 rounded-lg object-cover border border-[var(--candy-border)] shrink-0"
                              />
                            ) : (
                              <div className="size-12 rounded-lg bg-[#F1F5F9] border border-[var(--candy-border)] shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold truncate">{item.name}</div>
                              <div className="text-xs text-[var(--candy-muted)]">
                                {item.upc} &bull; Qty: {item.quantity}
                              </div>
                            </div>
                            <div className="text-sm font-bold shrink-0">
                              ${(Number(item.price) * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
