import { build, transform } from "esbuild";
import { compile } from "sass";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const output = "dist/v2ex-kit";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const entryPoint = fileURLToPath(new URL("../src/main.js", import.meta.url));
const userScript = fileURLToPath(new URL(`../${output}.user.js`, import.meta.url));
const plusTheme = fileURLToPath(new URL(`../${output}.plus-emerald.css`, import.meta.url));
const repository = "jetyu/v2ex-kit";
const homepage = `https://github.com/${repository}`;
const base = `https://raw.githubusercontent.com/${repository}/main/${output}`;
const icon = `https://raw.githubusercontent.com/${repository}/main/assets/v2ex-kit.png`;
const target = ["chrome120", "firefox121"];
const header = `// ==UserScript==
// @name         V2EX Kit
// @namespace    ${homepage}
// @version      ${version}
// @description  Improve V2EX reading and replies with themes, previews, tags, check-in and image uploads.
// @description:zh-CN  改善 V2EX 阅读与回复体验，提供主题切换、帖子预览、用户标签、自动签到和图片上传。
// @author       jetyu
// @license      MIT
// @homepageURL  ${homepage}
// @supportURL   ${homepage}/issues
// @icon         ${icon}
// @downloadURL  ${base}.user.js
// @updateURL    ${base}.meta.js
// @match        https://v2ex.com/*
// @match        https://*.v2ex.com/*
// @noframes
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.imgur.com
// @resource     v2ex-kit-theme-plus-emerald ${base}.plus-emerald.css?v=${version}
// @resource     v2ex-kit-theme-geist https://cdn.jsdelivr.net/gh/yuyinws/v2ex-theme@v1.5.0/v2ex-geist.css
// @resource     v2ex-kit-theme-claude https://cdn.jsdelivr.net/gh/yuyinws/v2ex-theme@v1.5.0/v2ex-claude.css
// ==/UserScript==`;

const minifyCSS = async (source) =>
  (
    await transform(source, {
      loader: "css",
      minify: true,
      target,
      legalComments: "inline",
    })
  ).code;

await mkdir(new URL("../dist", import.meta.url), { recursive: true });
await writeFile(
  plusTheme,
  await minifyCSS(
    await readFile(new URL("../src/themes/plus-emerald.css", import.meta.url), "utf8"),
  ),
);
await build({
  absWorkingDir: projectRoot,
  entryPoints: [entryPoint],
  bundle: true,
  format: "iife",
  target,
  minify: true,
  outfile: userScript,
  banner: {
    js: header,
  },
  legalComments: "inline",
  loader: { ".css": "text" },
  plugins: [
    {
      name: "styles",
      setup(builder) {
        builder.onLoad({ filter: /\.(scss|css)$/ }, async (args) => {
          const source = args.path.endsWith(".scss")
            ? compile(args.path).css
            : await readFile(args.path, "utf8");
          return { contents: await minifyCSS(source), loader: "text" };
        });
      },
    },
  ],
});
await writeFile(new URL(`../${output}.meta.js`, import.meta.url), `${header}\n`);
