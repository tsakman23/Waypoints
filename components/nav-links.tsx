"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "List" },
  { href: "/next", label: "Next up" },
  { href: "/system", label: "System" },
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

  // The links move when the nav changes size (window resized, phone rotated,
  // font finished loading), so measure again whenever it does.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(moveToCurrent);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [moveToCurrent]);

  return (
    // min-w-0 lets the links shrink inside the header; if a screen is ever too
    // narrow they scroll sideways (scrollbar hidden) instead of overflowing.
    <nav
      ref={navRef}
      onMouseLeave={moveToCurrent}
      onBlur={moveToCurrent}
      className="relative flex min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
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
            "relative shrink-0 rounded-full px-2 py-1.5 text-[13px] whitespace-nowrap transition-colors duration-200 sm:px-3 sm:text-sm",
            pathname === href ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
