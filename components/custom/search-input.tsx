"use client";

import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="flex-1 flex items-center gap-2.5 bg-white border border-[var(--candy-border)] rounded-2xl px-3 py-3 shadow-sm transition-colors focus-within:border-[var(--candy-accent)]">
      <Search className="size-4 text-[var(--candy-muted)] shrink-0" />
      <input
        type="text"
        placeholder="Search by name, description, or UPC..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-none outline-none bg-transparent text-sm font-sans"
      />
    </div>
  );
}
