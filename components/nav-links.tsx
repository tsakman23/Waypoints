"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "List" },
  { href: "/next", label: "Next up" },
  { href: "/graph", label: "Graph" },
];

/**
 * The view links in the header. A glowing pill sits behind the current page
 * and slides to whichever link is hovered or focused, then slides back.
 */
export function NavLinks() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const moveTo = useCallback((link: HTMLElement | null | undefined) => {
    if (link) setPill({ left: link.offsetLeft, width: link.offsetWidth });
  }, []);
  const moveToCurrent = useCallback(() => {
    moveTo(navRef.current?.querySelector<HTMLElement>('[aria-current="page"]'));
  }, [moveTo]);

  // Before the browser paints, and again whenever the page changes.
  useLayoutEffect(moveToCurrent, [pathname, moveToCurrent]);

  return (
    <nav ref={navRef} onMouseLeave={moveToCurrent} onBlur={moveToCurrent} className="relative flex">
      {pill && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 rounded-full bg-violet/25 shadow-[inset_0_0_0_1px_rgb(139_108_255/0.45),0_0_18px_rgb(139_108_255/0.35)] transition-[transform,width] duration-[380ms] ease-(--ease-out)"
          style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
        />
      )}
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          onMouseEnter={(e) => moveTo(e.currentTarget)}
          onFocus={(e) => moveTo(e.currentTarget)}
          className={cn(
            "relative rounded-full px-3 py-1.5 whitespace-nowrap transition-colors duration-200",
            pathname === href ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
