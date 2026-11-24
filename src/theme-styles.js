import themeVariables from "./vendor/polish/v2ex-theme-var.scss";
import plusCompatibility from "./themes/plus-compat.scss";
import foundation from "./vendor/polish/v2ex-theme-default.scss";
import features from "./vendor/polish/v2ex-effect.scss";
import decoration from "./themes/decoration.scss";
import replies from "./vendor/rep/content.scss";
import palettes from "./themes/index.scss";
import native from "./themes/native.scss";
import integration from "./styles.css";
import { EXTERNAL_THEMES } from "./theme.js";

const resources = Object.freeze({
  "plus-emerald": "v2ex-kit-theme-plus-emerald",
  geist: "v2ex-kit-theme-geist",
  claude: "v2ex-kit-theme-claude",
  platinum: "v2ex-kit-theme-platinum",
  still: "v2ex-kit-theme-still",
});

export function themeResourceName(theme) {
  return resources[theme] ?? null;
}

export function themeStyles(theme, resource = "") {
  const external = EXTERNAL_THEMES.includes(theme);
  if (theme === "native" || external) {
    const base = [native, features, replies, integration].join("\n");
    return external && resource ? `${resource}\n${base}` : base;
  }
  if (theme === "plus-emerald")
    return [plusCompatibility, features, replies, integration, resource].filter(Boolean).join("\n");
  return [themeVariables, foundation, features, decoration, replies, palettes, integration].join(
    "\n",
  );
}
