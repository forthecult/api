"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";

const API_BASE = getMainAppUrl();

export interface BrandOption {
  id: string;
  name: string;
}

interface BrandSelectProps {
  className?: string;
  disabled?: boolean;
  id?: string;
  inputClass?: string;
  labelClass?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

const MAX_VISIBLE = 100;

export function BrandSelect({
  className,
  disabled = false,
  id = "brand",
  inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  labelClass,
  onChange,
  placeholder = "Search or select brand…",
  value,
}: BrandSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [options, setOptions] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/admin/brands?limit=500`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: null | { items?: BrandOption[] }) => {
        if (cancelled || !data?.items) return;
        setOptions(data.items.map((b) => ({ id: b.id, name: b.name })));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOption = useMemo(
    () => options.find((b) => b.name === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((b) => b.name.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const visible = useMemo(() => filtered.slice(0, MAX_VISIBLE), [filtered]);

  const isOther = value !== "" && !selectedOption;

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, close]);

  // When opening, sync local search to current value and focus first match.
  // Do not depend on `visible` or typing would retrigger this and clear the search.
  useEffect(() => {
    if (!open) return;
    setSearchQuery(value);
    setFocusedIndex(
      Math.max(
        0,
        options.findIndex((b) => b.name === value),
      ),
    );
  }, [open, value, options]);

  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    listRef.current?.children[focusedIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [open, focusedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(visible.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter" && visible[focusedIndex]) {
        e.preventDefault();
        onChange(visible[focusedIndex].name);
        close();
      }
    },
    [open, visible, focusedIndex, onChange, close],
  );

  return (
    <div className={cn("space-y-2", className)} ref={containerRef}>
      {labelClass ? (
        <label className={labelClass} htmlFor={id}>
          Brand
        </label>
      ) : null}
      <div className="relative">
        <input
          aria-activedescendant={
            open && visible[focusedIndex]
              ? `${id}-option-${focusedIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={open ? `${id}-listbox` : undefined}
          aria-expanded={open}
          autoComplete="off"
          className={inputClass}
          disabled={disabled}
          id={id}
          onChange={(e) => {
            const v = e.target.value;
            if (open) {
              setSearchQuery(v);
              setFocusedIndex(0);
            } else {
              onChange(v);
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "Loading brands…" : placeholder}
          role="combobox"
          type="text"
          value={open ? searchQuery : value}
        />
        <span
          className={`
          pointer-events-none absolute top-1/2 right-2 -translate-y-1/2
          text-muted-foreground
        `}
        >
          <ChevronDown
            aria-hidden
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </span>
        {open && (
          <ul
            className={`
              absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border
              border-input bg-background py-1 shadow-md
            `}
            id={`${id}-listbox`}
            ref={listRef}
            role="listbox"
          >
            {visible.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? "No brands match. Type to use a custom brand."
                  : "No brands in system. Type a brand name."}
              </li>
            ) : (
              visible.map((b, i) => (
                <li
                  aria-selected={b.name === value}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm",
                    i === focusedIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                  id={`${id}-option-${i}`}
                  key={b.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(b.name);
                    close();
                  }}
                  onMouseEnter={() => setFocusedIndex(i)}
                  role="option"
                >
                  {b.name}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {isOther && (
        <p className="text-xs text-muted-foreground">
          Custom brand (not in list). It will still be saved.
        </p>
      )}
    </div>
  );
}
