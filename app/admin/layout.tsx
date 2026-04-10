"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/custom/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("nf_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAuthenticated(true);
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("nf_token");
    import("netlify-identity-widget").then((netlifyIdentity) => {
      netlifyIdentity.default.logout();
    });
    router.replace("/admin/login");
  }

  if (!authenticated) return null;

  return (
    <div className="flex h-screen">
      <AdminSidebar onLogout={handleLogout} />
      <main className="flex-1 overflow-auto p-6 bg-[var(--candy-bg)]">
        {children}
      </main>
    </div>
  );
}
