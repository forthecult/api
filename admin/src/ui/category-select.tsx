"use client";

import { ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "~/lib/cn";

export interface CategoryOption {
  id: string;
  name: string;
  /** When set, show "parentName > name" in the dropdown so subcategories are distinguishable. */
  parentName?: string | null;
}

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CategoryOption[];
  id?: string;
  className?: string;
  inputClass?: string;
  labelClass?: string;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_VISIBLE = 100;

export function CategorySelect({
  value,
  onChange,
  options,
  id = "categoryId",
  className,
  inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  labelClass,
  disabled = false,
  placeholder = "Search categories…",
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const displayName = useCallback((c: CategoryOption) => {
    if (c.parentName?.trim()) return `${c.parentName.trim()} → ${c.name}`;
    return c.name;
  }, []);

  const selectedOption = useMemo(
    () => options.find((c) => c.id === value) ?? null,
    [options, value],
  );
  const selectedLabel = selectedOption ? displayName(selectedOption) : "None";

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => {
      const label = displayName(c);
      return label.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });
  }, [options, searchQuery, displayName]);

  const visible = useMemo(
    () => filtered.slice(0, MAX_VISIBLE),
    [filtered],
  );

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
        setFocusedIndex((i) =>
          i < visible.length ? i + 1 : i,
        );
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
        else if (visible[focusedIndex - 1]) handleSelect(visible[focusedIndex - 1]!.id);
        return;
      }
      if (e.key === "Tab") {
        close();
      }
    },
    [open, visible, focusedIndex, close, handleSelect],
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
        )}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-labelledby={`${id}-label`}
        id={id}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (disabled) return;
          if (!open) setFocusedIndex(0);
          setOpen((o) => !o);
        }}
      >
        {open ? (
          <input
            type="text"
            className="min-w-0 flex-1 bg-transparent focus:outline-none"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFocusedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
                e.stopPropagation();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Search categories"
            autoFocus
          />
        ) : (
          <span className="flex-1 truncate text-left">
            {selectedLabel}
          </span>
        )}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground", open && "rotate-180")}
          aria-hidden
        />
      </div>
      {open && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-background py-1 shadow-lg"
        >
          <li
            role="option"
            aria-selected={value === ""}
            data-index={0}
            className={cn(
              "cursor-pointer px-3 py-2 text-sm",
              value === "" && "bg-muted",
              focusedIndex === 0 && "bg-muted",
            )}
            onClick={() => handleSelect("")}
            onMouseEnter={() => setFocusedIndex(0)}
          >
            None
          </li>
          {visible.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={value === c.id}
              data-index={i + 1}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                value === c.id && "bg-muted",
                focusedIndex === i + 1 && "bg-muted",
              )}
              onClick={() => handleSelect(c.id)}
              onMouseEnter={() => setFocusedIndex(i + 1)}
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
