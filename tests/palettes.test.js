import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compile } from "sass";
import { applyTheme, EXTERNAL_THEMES, normalizeTheme, PALETTE_THEMES } from "../src/theme.js";
import { dom } from "./helpers.js";

test("theme IDs are validated while Polish structure remains intact", () => {
  const { window } = dom('<div id="site-header"></div>');
  for (const value of [undefined, null, "unknown", ["vscode"], {}])
    assert.equal(normalizeTheme(value), "native");
  for (const theme of PALETTE_THEMES) {
    applyTheme(document, theme);
    assert.equal(document.documentElement.dataset.vxTheme, theme);
    assert.equal(document.documentElement.dataset.v2pTheme, "minimalist");
    assert.equal(document.body.classList.contains("v2p-theme-minimalist"), true);
  }
  for (const theme of EXTERNAL_THEMES) {
    applyTheme(document, theme);
    assert.equal(document.documentElement.dataset.vxTheme, theme);
    assert.equal(document.documentElement.dataset.v2pTheme, undefined);
    assert.equal(document.body.classList.contains("v2p-theme-minimalist"), false);
  }
  applyTheme(document, "vscode");
  const root = document.documentElement;
  assert.equal(root.dataset.vxTheme, "vscode");
  assert.equal(root.dataset.v2pTheme, "minimalist");
  assert.equal(root.dataset.v2pMobile, "true");
  assert.equal(document.body.classList.contains("v2p-theme-minimalist"), true);
  applyTheme(document);
  assert.equal(root.dataset.vxTheme, "vscode");
  applyTheme(document, "invalid");
  assert.equal(root.dataset.vxTheme, "native");
  assert.equal(root.dataset.v2pTheme, undefined);
  assert.equal(document.body.classList.contains("v2p-theme-minimalist"), false);
  window.close();
});

test("VS Code colors override the shared palette", () => {
  const { window } = dom(
    '<div id="Main"><div class="box"><div class="cell" id="r_1">Reply</div></div></div>',
  );
  const style = document.createElement("style");
  style.textContent = compile("src/theme.scss").css;
  document.head.append(style);
  applyTheme(document, "vscode");
  assert.equal(window.getComputedStyle(document.body).color, "rgb(59, 59, 59)");
  assert.equal(window.getComputedStyle(document.body).backgroundColor, "rgb(248, 248, 248)");
  assert.equal(
    window.getComputedStyle(document.documentElement).getPropertyValue("--v2p-color-accent-600"),
    "#005fb8",
  );
  window.close();
});

test("shared palette rules leave geometry alone", () => {
  const allowed = new Set([
    "color",
    "background-color",
    "background-image",
    "border-color",
    "outline",
    "outline-offset",
    "box-shadow",
    "transition",
  ]);
  for (const file of ["base", "compat", "shared-palette"])
    for (const [, property] of readFileSync(`src/themes/${file}.scss`, "utf8").matchAll(
      /^\s*([a-z-]+):/gm,
    ))
      assert.ok(
        property.startsWith("--") || allowed.has(property),
        `${file}: ${property} changes layout`,
      );
});

test("native theme leaves site colors and geometry intact while feature surfaces follow the site", () => {
  const { window } = dom(`<style>
    :root { --box-background-color:#ffffff; --box-foreground-color:#000000; --box-border-radius:3px; --color-gray:#999999; }
    :root.night { --box-background-color:#18222d; --box-foreground-color:#d1d5d9; --color-gray:#b2c3d4; }
    body { color:var(--box-foreground-color); margin:8px; }
    #Main .cell { padding:10px; background:var(--box-background-color); color:var(--box-foreground-color); }
    #Main a { color:#778087; }
  </style><div id="Main"><div class="cell" id="r_1"><a href="/member/Alice">Alice</a></div></div>
  <div class="vx-member-popup v2p-popup"><div class="v2p-popup-content"><div class="v2p-member-card">Card</div></div></div>`);
  const selectors = ["body", "#Main .cell", "#Main a"];
  const properties = [
    "color",
    "backgroundColor",
    "padding",
    "margin",
    "position",
    "fontFamily",
    "fontSize",
  ];
  const snapshot = () =>
    selectors.map((selector) => {
      const style = window.getComputedStyle(document.querySelector(selector));
      return Object.fromEntries(properties.map((property) => [property, style[property]]));
    });
  const original = snapshot();
  const style = document.createElement("style");
  style.textContent =
    ["src/themes/native.scss", "src/vendor/polish/v2ex-effect.scss", "src/vendor/rep/content.scss"]
      .map((file) => compile(file).css)
      .join("\n") + readFileSync("src/styles.css", "utf8");
  document.head.append(style);
  applyTheme(document, "native");
  assert.deepEqual(snapshot(), original);
  assert.equal(
    window.getComputedStyle(document.querySelector(".v2p-popup")).backgroundColor,
    "rgb(255, 255, 255)",
  );
  document.documentElement.classList.add("night");
  assert.equal(
    window.getComputedStyle(document.querySelector(".v2p-popup")).backgroundColor,
    "rgb(24, 34, 45)",
  );
  assert.equal(window.getComputedStyle(document.body).color, "rgb(209, 213, 217)");
  assert.equal(window.getComputedStyle(document.querySelector("#r_1")).padding, "10px");
  assert.equal(document.documentElement.dataset.v2pTheme, undefined);
  window.close();
});

test("enhanced themes follow the native dark selection and system changes in auto mode", () => {
  const { window } = dom('<div class="box">Panel</div><div class="v2p-modal-main">Dialog</div>');
  const root = document.documentElement;
  let onChange;
  const media = {
    matches: false,
    addEventListener(type, listener) {
      assert.equal(type, "change");
      assert.equal(onChange, undefined);
      onChange = listener;
    },
  };
  window.matchMedia = (query) => {
    assert.equal(query, "(prefers-color-scheme: dark)");
    return media;
  };
  const style = document.createElement("style");
  style.textContent = compile("src/theme.scss").css;
  document.head.append(style);
  const background = (node) => window.getComputedStyle(node).backgroundColor;
  const dialog = document.querySelector(".v2p-modal-main");

  root.dataset.siteTheme = "dark";
  applyTheme(document, "vscode");
  assert.equal(background(dialog), "rgb(31, 31, 31)");
  assert.equal(window.getComputedStyle(root).colorScheme, "dark");

  root.dataset.siteTheme = "auto";
  assert.equal(background(dialog), "rgb(255, 255, 255)");
  media.matches = true;
  onChange();
  assert.equal(background(dialog), "rgb(31, 31, 31)");
  root.dataset.siteTheme = "light";
  assert.equal(background(dialog), "rgb(255, 255, 255)");
  assert.equal(window.getComputedStyle(root).colorScheme, "light");
  window.close();
});

test("VS Code theme styles workbench tabs, breadcrumbs, code blocks, widgets and settings in light and dark modes", () => {
  const { window } = dom(`
    <div id="Top"><div id="search-container"></div></div>
    <div id="Wrapper"><div class="content">
      <div id="Main">
        <div class="box">
          <div id="Tabs"><a class="tab_current" href="/">技术</a><a class="tab" href="/?tab=creative">创意</a></div>
          <div id="SecondaryTabs"><a href="/go/programmer">程序员</a></div>
          <div class="cell item">
            <a class="node" href="/go/programmer">程序员</a>
            <a class="count_livid" href="/t/1">12</a>
          </div>
          <div class="topic_content">
            <a href="https://example.com">Link</a>
            <a href="/member/Alice">@Alice</a>
            <code>inline</code>
            <pre><code>block</code></pre>
            <blockquote>Quote</blockquote>
          </div>
          <div class="v2p-topic-preview-content"><a href="/t/2">Preview link</a></div>
          <div class="v2p-reply-content v2p-collapsed">
            <div class="reply_content">Long reply</div>
            <button type="button" class="normal button v2p-expand-btn">展开回复</button>
          </div>
          <div class="subtle">Supplement</div>
        </div>
        <div id="reply-box" class="box">
          <div class="v2p-lite-reply-tabs">
            <button type="button" class="v2p-lite-reply-tab is-active">编辑</button>
            <button type="button" class="v2p-lite-reply-tab">预览</button>
          </div>
          <form>
            <textarea id="reply_content"></textarea>
            <button type="submit" class="normal button">回复</button>
            <button type="button" class="normal button vx-editor-action-button">表情</button>
          </form>
        </div>
      </div>
      <div id="Rightbar"><div class="box"><a class="item_node" href="/go/python">Python</a></div></div>
    </div></div>
    <div id="Bottom">Status</div>
    <div class="v2p-popup">Hover</div>
    <div id="vx-settings-dialog" class="v2p-modal-mask">
      <div class="v2p-modal-main">
        <div class="v2p-modal-header"><button type="button" class="v2p-modal-close-btn">关闭</button></div>
        <div class="v2p-modal-content"><select><option>VS Code</option></select></div>
        <div class="v2p-modal-footer">
          <button type="button" class="normal button">应用</button>
          <button type="submit" class="normal button special">保存</button>
        </div>
      </div>
    </div>
  `);
  const themeCss = compile("src/theme.scss").css;
  const style = document.createElement("style");
  style.textContent = `${themeCss}\n${readFileSync("src/styles.css", "utf8")}`;
  document.head.append(style);
  const root = document.documentElement;
  const computed = (selector) => window.getComputedStyle(document.querySelector(selector));

  assert.doesNotMatch(themeCss, /\[data-vx-palette\][^{]*\.cell\.item:hover/);
  assert.doesNotMatch(themeCss, /\[data-vx-palette\][^{]*\.button[^{]*\{[^}]*transform:\s*none/);

  root.dataset.siteTheme = "light";
  applyTheme(document, "vscode");
  assert.equal(computed("#Top").borderBottomWidth, "1px");
  assert.equal(computed("#Bottom").borderTopWidth, "1px");
  assert.equal(computed("#Main > .box").backgroundColor, "rgb(255, 255, 255)");
  assert.equal(computed("#Rightbar > .box").backgroundColor, "rgb(255, 255, 255)");
  assert.equal(computed("#Tabs").flexWrap, "wrap");
  assert.equal(computed("#Tabs").backgroundColor, "rgb(255, 255, 255)");
  assert.equal(computed("#Tabs").marginInlineStart, "-12px");
  assert.equal(computed("#Tabs").marginInlineEnd, "-12px");
  assert.equal(computed("#Tabs").paddingInlineStart, "22px");
  assert.equal(computed("#Tabs .tab_current").borderRadius, "3px");
  assert.equal(computed("#Tabs .tab_current").color, "rgb(255, 255, 255)");
  assert.equal(computed("#Tabs .tab_current").backgroundColor, "rgb(0, 95, 184)");
  assert.equal(computed("#Tabs .tab_current").boxShadow, "none");
  assert.equal(computed(".v2p-lite-reply-tab.is-active").backgroundColor, "rgb(0, 95, 184)");
  assert.equal(computed(".v2p-lite-reply-tab.is-active").color, "rgb(255, 255, 255)");
  assert.equal(computed(".v2p-lite-reply-tab.is-active").boxShadow, "none");
  assert.equal(computed("#SecondaryTabs").borderRadius, "0px");
  assert.equal(computed("#SecondaryTabs").backgroundColor, "rgb(248, 248, 248)");
  assert.equal(computed("#SecondaryTabs").marginInlineStart, "-12px");
  assert.equal(computed("#SecondaryTabs").marginInlineEnd, "-12px");
  assert.equal(computed("#SecondaryTabs").paddingInlineStart, "22px");
  assert.equal(computed("#SecondaryTabs").paddingInlineEnd, "22px");
  assert.equal(
    window.getComputedStyle(root).getPropertyValue("--v2p-color-bg-hover-btn").trim(),
    "transparent",
  );
  assert.equal(
    window.getComputedStyle(root).getPropertyValue("--v2p-color-bg-link-hover").trim(),
    "transparent",
  );
  assert.equal(computed("#Main a.node").backgroundColor, "rgb(248, 248, 248)");
  assert.equal(computed("#Rightbar .item_node").backgroundColor, "rgb(248, 248, 248)");
  assert.equal(computed("#Main .count_livid").borderRadius, "3px");
  assert.equal(computed(".topic_content a").color, "rgb(0, 95, 184)");
  assert.equal(computed(".topic_content a").backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(computed('.topic_content a[href^="/member"]').color, "rgb(0, 95, 184)");
  assert.equal(computed(".v2p-topic-preview-content a").color, "rgb(0, 95, 184)");
  assert.equal(computed(".v2p-topic-preview-content a").backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(computed(".topic_content pre").backgroundColor, "rgb(248, 248, 248)");
  assert.equal(computed(".topic_content blockquote").borderLeftWidth, "3px");
  assert.equal(computed(".v2p-expand-btn").transform, "translateX(-50%)");
  assert.equal(computed(".subtle").backgroundImage, "none");
  assert.equal(computed('#reply-box [type="submit"]').backgroundColor, "rgb(0, 95, 184)");
  assert.equal(
    computed("#reply-box .vx-editor-action-button").backgroundColor,
    "rgb(229, 229, 229)",
  );
  assert.equal(computed(".v2p-popup").backgroundColor, "rgb(248, 248, 248)");
  assert.equal(
    computed("#vx-settings-dialog .v2p-modal-main").backgroundColor,
    "rgb(255, 255, 255)",
  );
  assert.equal(
    computed("#vx-settings-dialog .v2p-modal-header").backgroundColor,
    "rgb(255, 255, 255)",
  );
  assert.equal(computed("#vx-settings-dialog .button.special").backgroundColor, "rgb(51, 51, 68)");

  root.dataset.siteTheme = "dark";
  assert.equal(computed("body").backgroundColor, "rgb(24, 24, 24)");
  assert.equal(computed("#Rightbar > .box").backgroundColor, "rgb(31, 31, 31)");
  assert.equal(computed("#Tabs").backgroundColor, "rgb(31, 31, 31)");
  assert.equal(computed("#Tabs .tab_current").color, "rgb(255, 255, 255)");
  assert.equal(computed("#Tabs .tab_current").backgroundColor, "rgb(0, 120, 212)");
  assert.equal(computed("#Tabs .tab_current").boxShadow, "none");
  assert.equal(computed(".v2p-lite-reply-tab.is-active").backgroundColor, "rgb(0, 120, 212)");
  assert.equal(computed("#SecondaryTabs").backgroundColor, "rgb(24, 24, 24)");
  assert.equal(computed(".topic_content a").color, "rgb(77, 170, 252)");
  assert.equal(computed(".topic_content pre").backgroundColor, "rgb(24, 24, 24)");
  assert.equal(computed('#reply-box [type="submit"]').backgroundColor, "rgb(0, 120, 212)");
  assert.equal(computed("#reply-box .vx-editor-action-button").backgroundColor, "rgb(49, 49, 49)");
  assert.equal(computed(".v2p-popup").backgroundColor, "rgb(32, 32, 32)");
  assert.equal(computed("#vx-settings-dialog .v2p-modal-main").backgroundColor, "rgb(24, 34, 45)");
  assert.equal(
    computed("#vx-settings-dialog .v2p-modal-header").backgroundColor,
    "rgb(24, 34, 45)",
  );
  assert.equal(computed("#vx-settings-dialog .button.special").backgroundColor, "rgb(57, 63, 78)");
  window.close();
});

test("settings dialog keeps identical styling across native, VS Code and Plus Emerald themes", () => {
  const { window } = dom(`
    <div id="vx-settings-dialog" class="v2p-modal-mask">
      <div class="v2p-modal-main">
        <div class="v2p-modal-header"><button type="button" class="v2p-modal-close-btn">关闭</button></div>
        <div class="vx-settings-tabs"><button type="button" role="tab" aria-selected="true">常规</button></div>
        <div class="v2p-modal-content">
          <select><option>原生</option></select>
          <input type="text" value="client">
          <textarea>keyword</textarea>
        </div>
        <div class="v2p-modal-footer">
          <button type="button" class="normal button">应用</button>
          <button type="submit" class="normal button special">保存</button>
        </div>
      </div>
    </div>
  `);
  const baseStyles = readFileSync("src/styles.css", "utf8");
  const nativeCss = [
    compile("src/themes/native.scss").css,
    compile("src/vendor/polish/v2ex-effect.scss").css,
    compile("src/vendor/rep/content.scss").css,
    baseStyles,
  ].join("\n");
  const vscodeCss = `${compile("src/theme.scss").css}\n${baseStyles}`;
  const plusCss = [
    compile("src/vendor/polish/v2ex-theme-var.scss").css,
    compile("src/vendor/polish/v2ex-effect.scss").css,
    compile("src/vendor/rep/content.scss").css,
    baseStyles,
    readFileSync("src/themes/plus-emerald.css", "utf8"),
  ].join("\n");
  const style = document.createElement("style");
  document.head.append(style);
  const root = document.documentElement;
  const targets = [
    "#vx-settings-dialog .v2p-modal-main",
    "#vx-settings-dialog .v2p-modal-header",
    "#vx-settings-dialog .v2p-modal-footer",
    '#vx-settings-dialog [role="tab"]',
    "#vx-settings-dialog select",
    '#vx-settings-dialog input[type="text"]',
    "#vx-settings-dialog textarea",
    "#vx-settings-dialog .v2p-modal-close-btn",
    '#vx-settings-dialog button[type="button"].normal.button',
    "#vx-settings-dialog .button.special",
  ];
  const props = [
    "display",
    "backgroundColor",
    "color",
    "borderColor",
    "borderRadius",
    "boxShadow",
    "fontFamily",
    "lineHeight",
    "height",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "maxWidth",
  ];
  const snapshot = () =>
    targets.map((selector) => {
      const computed = window.getComputedStyle(document.querySelector(selector));
      return Object.fromEntries(props.map((prop) => [prop, computed[prop]]));
    });

  for (const mode of ["light", "dark"]) {
    root.dataset.siteTheme = mode;
    style.textContent = nativeCss;
    applyTheme(document, "native");
    const baseline = snapshot();

    style.textContent = vscodeCss;
    for (const theme of PALETTE_THEMES) {
      applyTheme(document, theme);
      assert.deepEqual(snapshot(), baseline, `${mode}: ${theme} leaked into settings dialog`);
    }

    style.textContent = plusCss;
    applyTheme(document, "plus-emerald");
    assert.deepEqual(snapshot(), baseline, `${mode}: plus-emerald leaked into settings dialog`);
  }
  window.close();
});

test("built-in GitHub, Linear, Notion, Catppuccin and Zhihu themes apply light and dark palettes", () => {
  const { window } = dom(
    '<div id="Main"><div class="box"><div id="Tabs"><a class="tab_current" href="/">技术</a></div></div></div>',
  );
  const style = document.createElement("style");
  style.textContent = compile("src/theme.scss").css;
  document.head.append(style);
  const root = document.documentElement;
  const cases = [
    ["github", "rgb(246, 248, 250)", "rgb(9, 105, 218)", "rgb(28, 33, 40)", "rgb(49, 109, 202)"],
    ["linear", "rgb(244, 245, 248)", "rgb(94, 106, 210)", "rgb(11, 12, 14)", "rgb(94, 106, 210)"],
    ["notion", "rgb(247, 246, 243)", "rgb(35, 131, 226)", "rgb(25, 25, 25)", "rgb(35, 131, 226)"],
    [
      "catppuccin",
      "rgb(230, 233, 239)",
      "rgb(30, 102, 245)",
      "rgb(24, 24, 37)",
      "rgb(59, 111, 216)",
    ],
    ["zhihu", "rgb(244, 246, 249)", "rgb(22, 119, 255)", "rgb(18, 18, 18)", "rgb(22, 119, 255)"],
  ];
  for (const [theme, lightPage, lightTab, darkPage, darkTab] of cases) {
    root.dataset.siteTheme = "light";
    applyTheme(document, theme);
    assert.equal(
      window.getComputedStyle(document.body).backgroundColor,
      lightPage,
      `${theme} light`,
    );
    assert.equal(
      window.getComputedStyle(document.querySelector(".tab_current")).backgroundColor,
      lightTab,
      `${theme} light tab`,
    );
    root.dataset.siteTheme = "dark";
    assert.equal(window.getComputedStyle(document.body).backgroundColor, darkPage, `${theme} dark`);
    assert.equal(
      window.getComputedStyle(document.querySelector(".tab_current")).backgroundColor,
      darkTab,
      `${theme} dark tab`,
    );
  }
  window.close();
});
