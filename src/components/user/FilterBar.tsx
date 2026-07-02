import React from 'react';
import { Search } from 'lucide-react';

/** Hàng công cụ lọc: search + select + nút, bọc card trắng mảnh cho gọn nhịp. */
export function FilterBar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 mb-5 ${className}`}>
      {children}
    </div>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Tìm kiếm...', className = '' }: SearchInputProps) {
  return (
    <div className={`relative flex-1 min-w-[12rem] ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cafe-400 pointer-events-none" />
      <input
        className="input-funcafe !pl-10"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default FilterBar;
