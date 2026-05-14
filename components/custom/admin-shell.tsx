"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import AdminSidebar from "@/components/custom/admin-sidebar";
import { signOutAction } from "./admin-shell-actions";

const INVOICE_ROUTE = /^\/admin\/orders\/\d+\/invoice$/;

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (INVOICE_ROUTE.test(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar
        onLogout={() => signOutAction()}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-3 border-b border-[var(--candy-border)] bg-white md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-black">
            Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
          </span>
        </div>
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-[var(--candy-bg)]">
          {children}
        </main>
      </div>
    </div>
  );
}
