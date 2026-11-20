import themeVariables from "./vendor/polish/v2ex-theme-var.scss";
import foundation from "./vendor/polish/v2ex-theme-default.scss";
import features from "./vendor/polish/v2ex-effect.scss";
import decoration from "./themes/decoration.scss";
import replies from "./vendor/rep/content.scss";
import palettes from "./themes/index.scss";
import native from "./themes/native.scss";
import integration from "./styles.css";
import plus from "./themes/plus-emerald.css";
import { EXTERNAL_THEMES } from "./theme.js";

export function themeStyles(theme) {
  const external = EXTERNAL_THEMES.includes(theme);
  if (theme === "native" || external) {
    const base = [native, features, replies, integration].join("\n");
    return external
      ? `@import url("https://cdn.jsdelivr.net/gh/yuyinws/v2ex-theme@v1.5.0/v2ex-${theme}.css");\n${base}`
      : base;
  }
  if (theme === "plus-emerald")
    return [themeVariables, features, replies, integration, plus].join("\n");
  return [themeVariables, foundation, features, decoration, replies, palettes, integration].join(
    "\n",
  );
}
