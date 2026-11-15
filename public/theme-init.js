/**
 * Theme bootstrap, loaded as a plain same-origin script from <head> so it
 * runs before first paint (no flash of the wrong palette).
 *
 * It used to be an inline script stamped with the per-request CSP nonce,
 * which forced every public page to render dynamically (the nonce is read
 * through headers()). As a static file it needs no nonce — `script-src
 * 'self'` allows it — so public content pages can be ISR/static.
 * `data-default-theme` carries the CMS default; a stored visitor
 * preference in localStorage wins over it.
 */
(function () {
  document.documentElement.classList.add("js");
  try {
    var stored = localStorage.getItem("ps-theme");
    // next/script may relocate the tag; fall back to a query if
    // document.currentScript is unavailable at execution time.
    var tag = document.currentScript || document.querySelector('script[data-default-theme]');
    var fallback = (tag && tag.getAttribute("data-default-theme")) || "system";
    var preference = stored || fallback;
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
