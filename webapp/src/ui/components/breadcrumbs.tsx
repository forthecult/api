import Link from "next/link";

export interface BreadcrumbItem {
  href: string;
  name: string;
}

interface Props {
  items: BreadcrumbItem[];
  /** If true, the last item is rendered as text (current page); otherwise as a link. */
  lastIsCurrentPage?: boolean;
}

export function Breadcrumbs({ items, lastIsCurrentPage = true }: Props) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol
        className={`
          flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground
        `}
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const isCurrent = isLast && lastIsCurrentPage;
          return (
            <li className="flex items-center gap-1.5" key={`${item.href}-${i}`}>
              {i > 0 && (
                <span aria-hidden className="select-none">
                  &gt;
                </span>
              )}
              {isCurrent ? (
                <span
                  className={`
                    max-w-[200px] truncate font-medium text-foreground
                    md:max-w-none
                  `}
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  className={`
                    max-w-[200px] truncate
                    hover:text-foreground
                    md:max-w-none
                  `}
                  href={item.href}
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
