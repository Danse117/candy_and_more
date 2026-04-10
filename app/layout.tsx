import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { CartProvider } from "@/lib/cart-context";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Candy & More — Wholesale Catalog",
  description:
    "Browse our full wholesale snack and candy catalog. Search by name, description, or UPC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
