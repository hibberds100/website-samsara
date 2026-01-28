export type Lang = "en" | "pt";

export function getLangFromPath(pathname: string): Lang {
  return pathname === "/pt" || pathname.startsWith("/pt/") ? "pt" : "en";
}

/**
 * GitHub Pages uses BASE_URL (e.g. /website-samsara/).
 * This helper prefixes internal links with BASE_URL,
 * and leaves absolute/mailto/tel links untouched.
 */
export function withBase(href: string): string {
  if (!href) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("mailto:")) return href;
  if (href.startsWith("tel:")) return href;

  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const normalized = href.startsWith("/") ? href : `/${href}`;
  return `${base}${normalized}`;
}

/**
 * Build an internal site link:
 * - ensures /en or /pt prefix
 * - then applies GitHub Pages base
 */
export function withLang(href: string, lang: Lang): string {
  if (!href) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("mailto:")) return href;
  if (href.startsWith("tel:")) return href;

  // already language-prefixed
  if (
    href === "/en" ||
    href.startsWith("/en/") ||
    href === "/pt" ||
    href.startsWith("/pt/")
  ) {
    return withBase(href);
  }

  const normalized = href.startsWith("/") ? href : `/${href}`;
  return withBase(`/${lang}${normalized}`);
}

/**
 * Swap language but keep same path after /en or /pt.
 * Example: /en/shop -> /pt/shop
 */
export function switchLangPath(pathname: string, to: Lang): string {
  const stripped =
    pathname === "/en"
      ? "/"
      : pathname === "/pt"
      ? "/"
      : pathname.startsWith("/en/")
      ? pathname.slice(3)
      : pathname.startsWith("/pt/")
      ? pathname.slice(3)
      : pathname;

  return `/${to}${stripped.startsWith("/") ? "" : "/"}${stripped}`;
}