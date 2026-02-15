"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "~/lib/cn";

export interface CategoryOption {
  id: string;
  name: string;
  /** When set, show "parentName → name" in the dropdown so subcategories are distinguishable. */
  parentName?: null | string;
  /** Optional slug; used to disambiguate when two options have the same display label (e.g. two "Hoodies" under same parent). */
  slug?: null | string;
}

interface CategorySelectProps {
  className?: string;
  disabled?: boolean;
  /** When value is empty, show this instead of "None" (e.g. "Add a category…"). */
  emptyLabel?: string;
  id?: string;
  inputClass?: string;
  labelClass?: string;
  onChange: (value: string) => void;
  options: CategoryOption[];
  placeholder?: string;
  value: string;
}

const MAX_VISIBLE = 100;

export function CategorySelect({
  className,
  disabled = false,
  emptyLabel,
  id = "categoryId",
  inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  labelClass,
  onChange,
  options,
  placeholder = "Search categories…",
  value,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const baseDisplayName = useCallback((c: CategoryOption) => {
    if (c.parentName?.trim()) return `${c.parentName.trim()} → ${c.name}`;
    return c.name;
  }, []);

  const displayNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of options) {
      const label = baseDisplayName(c);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return counts;
  }, [options, baseDisplayName]);

  const displayName = useCallback(
    (c: CategoryOption) => {
      const label = baseDisplayName(c);
      const isDuplicate = (displayNameCounts.get(label) ?? 0) > 1;
      if (isDuplicate && c.slug?.trim()) {
        return `${label} (${c.slug.trim()})`;
      }
      return label;
    },
    [baseDisplayName, displayNameCounts],
  );

  const selectedOption = useMemo(
    () => options.find((c) => c.id === value) ?? null,
    [options, value],
  );
  const selectedLabel = selectedOption
    ? displayName(selectedOption)
    : (emptyLabel ?? "None");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => {
      const label = displayName(c);
      return (
        label.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    });
  }, [options, searchQuery, displayName]);

  const visible = useMemo(() => filtered.slice(0, MAX_VISIBLE), [filtered]);

  const close = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
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

  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const el = listRef.current?.querySelector(
      `[data-index="${focusedIndex}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, focusedIndex]);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      close();
    },
    [onChange, close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
          setFocusedIndex(0);
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
        setFocusedIndex((i) => (i < visible.length ? i + 1 : i));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => (i > 0 ? i - 1 : 0));
        return;
      }
      if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        if (focusedIndex === 0) handleSelect("");
        else if (visible[focusedIndex - 1])
          handleSelect(visible[focusedIndex - 1]!.id);
        return;
      }
      if (e.key === "Tab") {
        close();
      }
    },
    [open, visible, focusedIndex, close, handleSelect],
  );

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div
        aria-controls={`${id}-listbox`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label`}
        className={cn(
          `
            flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md
            border border-input bg-background px-3 py-2 text-sm
            ring-offset-background
            focus-within:ring-2 focus-within:ring-ring
          `,
          disabled && "cursor-not-allowed opacity-50",
        )}
        id={id}
        onClick={() => {
          if (disabled) return;
          if (!open) setFocusedIndex(0);
          setOpen((o) => !o);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
      >
        {open ? (
          <input
            aria-label="Search categories"
            autoFocus
            className={`
              min-w-0 flex-1 bg-transparent
              focus:outline-none
            `}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFocusedIndex(0);
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (
                e.key === "ArrowDown" ||
                e.key === "ArrowUp" ||
                e.key === "Enter"
              ) {
                e.stopPropagation();
              }
            }}
            placeholder={placeholder}
            type="text"
            value={searchQuery}
          />
        ) : (
          <span className="flex-1 truncate text-left">{selectedLabel}</span>
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground",
            open && "rotate-180",
          )}
        />
      </div>
      {open && (
        <ul
          className={`
            absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border
            border-input bg-background py-1 shadow-lg
          `}
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
        >
          <li
            aria-selected={value === ""}
            className={cn(
              "cursor-pointer px-3 py-2 text-sm",
              value === "" && "bg-muted",
              focusedIndex === 0 && "bg-muted",
            )}
            data-index={0}
            onClick={() => handleSelect("")}
            onMouseEnter={() => setFocusedIndex(0)}
            role="option"
          >
            None
          </li>
          {visible.map((c, i) => (
            <li
              aria-selected={value === c.id}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                value === c.id && "bg-muted",
                focusedIndex === i + 1 && "bg-muted",
              )}
              data-index={i + 1}
              key={c.id}
              onClick={() => handleSelect(c.id)}
              onMouseEnter={() => setFocusedIndex(i + 1)}
              role="option"
            >
              {displayName(c)}
            </li>
          ))}
          {filtered.length > MAX_VISIBLE && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              Showing first {MAX_VISIBLE} of {filtered.length}. Narrow search.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
