"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import AdminSidebar from "@/components/custom/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    const token = sessionStorage.getItem("nf_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAuthenticated(true);
  }, [router, isLoginPage]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function handleLogout() {
    sessionStorage.removeItem("nf_token");
    window.netlifyIdentity?.logout();
    router.replace("/admin/login");
  }

  if (isLoginPage) return <>{children}</>;
  if (!authenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
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
