import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("release artifact retains metadata within its size budget", () => {
  const built = readFileSync(new URL("../dist/v2ex-kit.user.js", import.meta.url), "utf8");
  const metadata = readFileSync(new URL("../dist/v2ex-kit.meta.js", import.meta.url), "utf8");
  const { description, version } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.ok(built.startsWith(metadata));
  assert.doesNotMatch(built.slice(metadata.length), /^\/\/ (?:@\w+\s|==\/?UserScript==)/m);
  assert.match(metadata, /^\/\/ @name\s+V2EX Kit$/m);
  assert.match(metadata, new RegExp(`^// @version\\s+${version.replaceAll(".", "\\.")}$`, "m"));
  assert.match(metadata, /^\/\/ @description\s+Improve V2EX reading and replies/m);
  assert.ok(metadata.includes(`// @description:zh-CN  ${description}\n`));
  assert.match(metadata, /^\/\/ @noframes$/m);
  for (const grant of [
    "GM_getValue",
    "GM_setValue",
    "GM_deleteValue",
    "GM_listValues",
    "GM_addValueChangeListener",
    "GM_addStyle",
    "GM_getResourceText",
    "GM_registerMenuCommand",
    "GM_xmlhttpRequest",
    "unsafeWindow",
  ]) {
    assert.match(metadata, new RegExp(`^// @grant\\s+${grant}$`, "m"));
  }
  assert.match(metadata, /^\/\/ @connect\s+api\.imgur\.com$/m);
  const base = "https://raw.githubusercontent.com/jetyu/v2ex-kit/main/dist/v2ex-kit";
  const plusTheme =
    "https://raw.githubusercontent.com/jetyu/v2ex-kit/main/src/themes/plus-emerald.css";
  assert.ok(metadata.includes(`// @downloadURL  ${base}.user.js\n`));
  assert.ok(metadata.includes(`// @updateURL    ${base}.meta.js\n`));
  assert.ok(
    metadata.includes(`// @resource     v2ex-kit-theme-plus-emerald ${plusTheme}?v=${version}\n`),
  );
  assert.match(metadata, /^\/\/ @resource\s+v2ex-kit-theme-geist https:\/\/cdn\.jsdelivr\.net\//m);
  assert.match(metadata, /^\/\/ @resource\s+v2ex-kit-theme-claude https:\/\/cdn\.jsdelivr\.net\//m);
  assert.match(
    metadata,
    /^\/\/ @resource\s+v2ex-kit-theme-platinum https:\/\/cdn\.jsdelivr\.net\//m,
  );
  assert.match(metadata, /^\/\/ @resource\s+v2ex-kit-theme-still https:\/\/cdn\.jsdelivr\.net\//m);
  assert.ok(Buffer.byteLength(built) <= 300 * 1024, "Release userscript exceeds 300 KiB");
  assert.doesNotMatch(built, /Generator: Adobe Illustrator 29\.1\.0/);
  assert.doesNotMatch(
    built,
    /accounts\.google\.com\/gsi\/client|https:\/\/api\.github\.com\/repos\//,
  );
});
