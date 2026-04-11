import type { Metadata } from "next";
import Script from "next/script";
import { DM_Sans } from "next/font/google";
import { connection } from "next/server";
import { CartProvider } from "@/lib/cart-context";
import { getProducts } from "@/lib/products";
import NetlifyIdentityInit from "@/components/custom/netlify-identity-init";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const products = await getProducts();

  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden">
        {/*
          Synchronous recovery-token redirect. Runs before the Netlify
          Identity widget script can load and auto-consume the single-use
          token. If `#recovery_token=...` is in the URL (and we're not on
          the recovery page already), rewrite to /admin/recover?token=...
          so that page becomes the only thing that ever calls gotrue.recover().
        */}
        <Script id="nf-recovery-redirect" strategy="beforeInteractive">
          {`(function(){try{var m=(window.location.hash||'').match(/[#&]recovery_token=([^&]+)/);if(m&&window.location.pathname!=='/admin/recover'){window.location.replace('/admin/recover?token='+encodeURIComponent(m[1]));}}catch(e){}})();`}
        </Script>
        <NetlifyIdentityInit />
        <CartProvider products={products}>{children}</CartProvider>
      </body>
    </html>
  );
}
