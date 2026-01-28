export type Lang = "en" | "pt";

export function getLangFromPath(pathname: string): Lang {
  return pathname === "/pt" || pathname.startsWith("/pt/") ? "pt" : "en";
}

/**
 * Prefix with the site base (GitHub Pages) + keep absolute/mailto/tel untouched.
 * Uses your astro.config.mjs `base`.
 */
export function withBase(href: string, base: string): string {
  if (!href) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("mailto:")) return href;
  if (href.startsWith("tel:")) return href;

  // Ensure leading slash so base joining is consistent
  const normalized = href.startsWith("/") ? href : `/${href}`;
  return `${base}${normalized}`;
}

/**
 * Build an internal site link:
 * - ensures /en or /pt prefix
 * - then applies GitHub Pages base
 */
export function withLang(
  href: string,
  lang: Lang,
  base: string
): string {
  if (!href) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("mailto:")) return href;
  if (href.startsWith("tel:")) return href;

  // already language-prefixed
  if (href === "/en" || href.startsWith("/en/") || href === "/pt" || href.startsWith("/pt/")) {
    return withBase(href, base);
  }

  // add language prefix
  const normalized = href.startsWith("/") ? href : `/${href}`;
  return withBase(`/${lang}${normalized}`, base);
}

/**
 * Swap language but keep same path after /en or /pt.
 * Example: /en/shop -> /pt/shop
 */
export function switchLangPath(pathname: string, to: Lang): string {
  const stripped =
    pathname === "/en" ? "/" :
    pathname === "/pt" ? "/" :
    pathname.startsWith("/en/") ? pathname.slice(3) :
    pathname.startsWith("/pt/") ? pathname.slice(3) :
    pathname; // if not prefixed

  return `/${to}${stripped.startsWith("/") ? "" : "/"}${stripped}`;
}