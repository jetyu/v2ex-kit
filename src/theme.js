export const THEME_STYLE_ID = "v2ex-kit-theme";
export const DEFAULT_THEME = "native";
export const EXTERNAL_THEMES = Object.freeze(["geist", "claude"]);
export const THEMES = Object.freeze(["plus-emerald", ...EXTERNAL_THEMES, "vscode", "native"]);

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : DEFAULT_THEME;
}

export function applyTheme(doc = document, theme = doc.documentElement?.dataset.vxTheme) {
  const root = doc.documentElement;
  if (!root) return;
  root.dataset.vxTheme = normalizeTheme(theme);
  const native =
    root.dataset.vxTheme === "native" || EXTERNAL_THEMES.includes(root.dataset.vxTheme);
  if (native) delete root.dataset.v2pTheme;
  else root.dataset.v2pTheme = "minimalist";
  if (!root.hasAttribute("data-vx-system-dark")) {
    const scheme = doc.defaultView?.matchMedia?.("(prefers-color-scheme: dark)");
    const sync = () => (root.dataset.vxSystemDark = scheme?.matches ? "1" : "0");
    sync();
    scheme?.addEventListener("change", sync);
  }
  if (/^\/t\/\d+/.test(doc.location?.pathname ?? location.pathname)) root.dataset.v2pPage = "topic";
  doc.body?.classList.toggle("v2p-theme-minimalist", !native);
  if (doc.querySelector("#site-header")) {
    root.dataset.v2pMobile = "true";
    doc.body?.classList.add("v2p-mobile");
    if (!doc.getElementById("Main")) {
      const content = doc.querySelector("#Wrapper > .content:not([id])");
      if (content) content.id = "Main";
    }
  }
}
