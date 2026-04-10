"use client";

import { useEffect, useState } from "react";

interface Order {
  id: number;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  note: string | null;
  items: string; // JSON string
  total_price: string;
  submitted_at: string;
  created_at: string;
}

interface OrderItem {
  name: string;
  upc: string;
  quantity: number;
  price: number;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("nf_token");
    fetch("/api/admin/orders", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrders(data);
      });
  }, []);

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
            const items: OrderItem[] = JSON.parse(order.items);
            const isExpanded = expanded === order.id;

            return (
              <div
                key={order.id}
                className="bg-white border border-[var(--candy-border)] rounded-[18px] shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F8FAFC] transition-colors"
                >
                  <div>
                    <div className="font-bold text-sm">
                      {order.customer_first_name} {order.customer_last_name}
                    </div>
                    <div className="text-xs text-[var(--candy-muted)]">
                      {order.customer_email} &bull;{" "}
                      {new Date(order.submitted_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-[#16A34A]">
                      ${Number(order.total_price).toFixed(2)}
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
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--candy-muted)]">
                          <th className="pb-2 font-bold text-xs">Product</th>
                          <th className="pb-2 font-bold text-xs">UPC</th>
                          <th className="pb-2 font-bold text-xs text-center">Qty</th>
                          <th className="pb-2 font-bold text-xs text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className="border-t border-[rgba(226,232,240,0.5)]">
                            <td className="py-2">{item.name}</td>
                            <td className="py-2 font-mono text-xs text-[var(--candy-muted)]">
                              {item.upc}
                            </td>
                            <td className="py-2 text-center">{item.quantity}</td>
                            <td className="py-2 text-right font-bold">
                              ${(item.price * item.quantity).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
