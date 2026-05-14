"use client";

import { useEffect, useState } from "react";
import { Printer, Download, CheckCircle, Check } from "lucide-react";

interface Order {
  id: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  storeAddress: string | null;
  note: string | null;
  items: string; // JSON string
  totalPrice: string;
  submittedAt: string;
  createdAt: string;
  fulfilledAt: string | null;
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
  const [filter, setFilter] = useState<"all" | "unfulfilled" | "fulfilled">("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/orders").then((r) => r.json()),
      fetch("/api/admin/products").then((r) => r.json()),
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

  async function toggleFulfilled(order: Order) {
    const wasFulfilled = order.fulfilledAt !== null;
    const nextValue = !wasFulfilled;

    // Optimistic update with client-side timestamp
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, fulfilledAt: nextValue ? new Date().toISOString() : null }
          : o
      )
    );

    const res = await fetch(`/api/admin/orders/${order.id}/fulfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fulfilled: nextValue }),
    });

    if (!res.ok) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, fulfilledAt: order.fulfilledAt } : o
        )
      );
      alert("Failed to update fulfillment status.");
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (filter === "fulfilled") return o.fulfilledAt !== null;
    if (filter === "unfulfilled") return o.fulfilledAt === null;
    return true;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <h1 className="text-2xl font-black">Orders</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | "unfulfilled" | "fulfilled")}
          className="border border-[var(--candy-border)] rounded-[14px] py-2 px-3 bg-white text-sm w-full sm:w-auto"
        >
          <option value="all">All</option>
          <option value="unfulfilled">Unfulfilled</option>
          <option value="fulfilled">Fulfilled</option>
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-8 text-center text-[var(--candy-muted)] shadow-sm">
          No orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
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
                    <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                      <span>{order.customerFirstName} {order.customerLastName}</span>
                      {order.fulfilledAt && (
                        <span className="inline-block bg-[var(--candy-green-bg)] text-[#065F46] text-xs font-bold rounded-full py-0.5 px-2">
                          Fulfilled
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--candy-muted)] truncate">
                      {[order.customerEmail, order.customerPhone].filter(Boolean).join(" • ") || "No contact info"} &bull; {submittedDate}
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
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/admin/orders/${order.id}/invoice?print=1`, "_blank");
                        }}
                        className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[#F1F5F9] border border-[var(--candy-border)] text-xs font-bold hover:bg-[#E2E8F0] transition-colors"
                      >
                        <Printer className="size-3.5" /> Print
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/admin/orders/${order.id}/invoice?download=1`, "_blank");
                        }}
                        className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[#F1F5F9] border border-[var(--candy-border)] text-xs font-bold hover:bg-[#E2E8F0] transition-colors"
                      >
                        <Download className="size-3.5" /> Download PDF
                      </button>
                      {order.fulfilledAt ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFulfilled(order);
                          }}
                          className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[#F1F5F9] border border-[var(--candy-border)] text-[var(--candy-muted)] text-xs font-bold hover:bg-[#E2E8F0] transition-colors"
                        >
                          <Check className="size-3.5" /> Fulfilled (click to undo)
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFulfilled(order);
                          }}
                          className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[var(--candy-green-bg)] border border-[var(--candy-green-border)] text-[#065F46] text-xs font-bold hover:bg-[rgba(52,211,153,0.28)] transition-colors"
                        >
                          <CheckCircle className="size-3.5" /> Mark Fulfilled
                        </button>
                      )}
                    </div>
                    {/* Customer details */}
                    <div className="text-sm mb-3 space-y-1">
                      {order.customerEmail && (
                        <p className="text-[var(--candy-muted)]">
                          <span className="font-bold">Email:</span> {order.customerEmail}
                        </p>
                      )}
                      {order.customerPhone && (
                        <p className="text-[var(--candy-muted)]">
                          <span className="font-bold">Phone:</span> {order.customerPhone}
                        </p>
                      )}
                      {order.storeAddress && (
                        <p className="text-[var(--candy-muted)]">
                          <span className="font-bold">Store Address:</span> {order.storeAddress}
                        </p>
                      )}
                    </div>
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
