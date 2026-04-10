"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import CartItemRow from "@/components/custom/cart-item-row";
import Footer from "@/components/custom/footer";
import type { OrderPayload } from "@/lib/types";

export default function CartClient() {
  const { items, clearCart, totalItems, getProductById } = useCart();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const cartProducts = Array.from(items.entries())
    .map(([id, qty]) => ({ product: getProductById(id), quantity: qty }))
    .filter((item): item is { product: NonNullable<typeof item.product>; quantity: number } =>
      item.product !== undefined
    );

  const totalPrice = cartProducts.reduce(
    (sum, { product, quantity }) => sum + product.price * quantity,
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (cartProducts.length === 0) {
      setErrorMessage("Your cart is empty.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setErrorMessage("");

    const payload: OrderPayload = {
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: email,
      note: note || undefined,
      items: cartProducts.map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        upc: product.upc,
        quantity,
        price: product.price,
      })),
      totalPrice,
      submittedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/send-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit order");
      }

      setStatus("success");
      clearCart();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-[var(--candy-border)] bg-[rgba(248,250,252,0.78)] backdrop-blur-[10px]">
        <div className="mx-auto max-w-[1180px] px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-[var(--candy-muted)] hover:text-[var(--candy-text)] transition-colors no-underline"
            >
              <ArrowLeft className="size-4" />
              Back to catalog
            </Link>
            <div className="text-2xl font-black tracking-tight ml-auto">
              Candy <span className="text-[var(--candy-accent)]">&</span> More
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-4 py-8">
        <h1 className="text-2xl font-black mb-6">Checkout</h1>

        {status === "success" ? (
          <div className="border border-[var(--candy-green-border)] bg-[var(--candy-green-bg)] rounded-[20px] p-8 text-center">
            <h2 className="text-xl font-black text-[#065F46] mb-2">Order Submitted!</h2>
            <p className="text-[#065F46] text-sm">
              A confirmation email has been sent. We&apos;ll be in touch soon.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 rounded-2xl py-3 px-6 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black no-underline transition-colors hover:bg-[rgba(96,165,250,0.28)]"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div className="border border-[var(--candy-border)] rounded-[18px] bg-white p-3 shadow-sm mb-6">
              {cartProducts.length === 0 ? (
                <div className="text-[var(--candy-muted)] p-6 text-center">
                  Your cart is empty.{" "}
                  <Link href="/" className="text-[var(--candy-accent)] underline">
                    Browse products
                  </Link>
                </div>
              ) : (
                cartProducts.map(({ product, quantity }) => (
                  <CartItemRow key={product.id} product={product} quantity={quantity} />
                ))
              )}
            </div>

            {/* Totals */}
            {cartProducts.length > 0 && (
              <div className="border border-[var(--candy-border)] rounded-[18px] p-4 bg-white shadow-sm mb-6">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-[var(--candy-muted)]">Items</span>
                  <b>{totalItems}</b>
                </div>
                <div className="flex justify-between items-center text-base">
                  <span className="text-[var(--candy-muted)]">Estimated total</span>
                  <b className="text-lg font-black">${totalPrice.toFixed(2)}</b>
                </div>
              </div>
            )}

            {/* Contact form */}
            <form onSubmit={handleSubmit}>
              <div className="border border-[var(--candy-border)] rounded-[18px] p-4 bg-white shadow-sm mb-6">
                <h3 className="text-sm font-black mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    required
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full"
                  />
                  <input
                    required
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full"
                  />
                </div>
                <input
                  required
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-3 border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full"
                />
                <textarea
                  placeholder="Add a note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="mt-3 border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full resize-none"
                />
              </div>

              {status === "error" && errorMessage && (
                <div className="text-[#B00020] text-sm mb-4 px-1">{errorMessage}</div>
              )}

              <button
                type="submit"
                disabled={status === "sending" || cartProducts.length === 0}
                className="w-full rounded-2xl py-3.5 px-4 cursor-pointer bg-[var(--candy-green-bg)] border border-[var(--candy-green-border)] text-[#065F46] font-black text-base transition-all hover:bg-[rgba(52,211,153,0.28)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "sending" ? "Sending..." : "Submit Order"}
              </button>
            </form>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
