import Link from "next/link";

export type BreadcrumbItem = { name: string; href: string };

type Props = {
  items: BreadcrumbItem[];
  /** If true, the last item is rendered as text (current page); otherwise as a link. */
  lastIsCurrentPage?: boolean;
};

export function Breadcrumbs({ items, lastIsCurrentPage = true }: Props) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const isCurrent = isLast && lastIsCurrentPage;
          return (
            <li key={`${item.href}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="select-none">
                  &gt;
                </span>
              )}
              {isCurrent ? (
                <span className="font-medium text-foreground truncate max-w-[200px] md:max-w-none">
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground truncate max-w-[200px] md:max-w-none"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
