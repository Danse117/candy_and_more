"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ShoppingCart, LogOut } from "lucide-react";

interface AdminSidebarProps {
  onLogout: () => void;
}

export default function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "Dashboard", icon: Package },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  ];

  return (
    <aside className="w-[240px] bg-white border-r border-[var(--candy-border)] p-4 flex flex-col h-full">
      <div className="text-lg font-black mb-6">
        Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
      </div>
      <p className="text-[10px] font-bold text-[var(--candy-muted)] uppercase tracking-wider mb-3">
        Admin
      </p>
      <nav className="flex flex-col gap-1 flex-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold no-underline transition-colors ${
              pathname === href
                ? "bg-[var(--candy-accent-bg)] text-[#0B3B66]"
                : "text-[var(--candy-muted)] hover:text-[var(--candy-text)] hover:bg-[#F1F5F9]"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={onLogout}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-[var(--candy-muted)] hover:text-[#7F1D1D] hover:bg-[rgba(239,68,68,0.08)] transition-colors"
      >
        <LogOut className="size-4" />
        Sign Out
      </button>
    </aside>
  );
}
