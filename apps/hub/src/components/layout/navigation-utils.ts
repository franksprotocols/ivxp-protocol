/**
 * Determines if a navigation link should be marked as active
 * based on the current pathname.
 *
 * For the root path "/", only an exact match is considered active.
 * For other paths, both exact matches and sub-routes are active
 * (e.g. "/marketplace/some-service" activates "/marketplace").
 */
export function isActiveLink(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
