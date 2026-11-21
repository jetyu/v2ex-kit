import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "sass";
import { readFileSync } from "node:fs";
import { replyActions } from "../src/dom.js";
import { dom } from "./helpers.js";

test("requested padding stays scoped to the topic list and top-level replies", () => {
  dom(
    '<style>.cell {padding:10px}.reply-group > .reply-group-item {padding:8px 0} #Rightbar .cell.item {padding:7px}</style><div id="Main"><div class="box"><div id="Tabs"></div><div class="cell item" id="topic"></div></div><div class="box"><div class="cell item" id="other"></div></div><div class="box reply-threads-c"><div class="cell" id="r_1"></div><div class="reply-group"><div class="cell reply-group-item" id="r_2"></div></div></div></div><div id="Rightbar"><div class="cell item" id="side"></div></div>',
  );
  const style = document.createElement("style");
  style.textContent = compile("src/theme.scss").css;
  document.head.append(style);
  const padding = (id) => window.getComputedStyle(document.getElementById(id)).padding;
  assert.equal(padding("topic"), "15px 10px");
  assert.equal(padding("other"), "20px 10px");
  assert.equal(padding("r_1"), "15px 10px");
  assert.equal(padding("r_2"), "8px 0px");
  assert.equal(padding("side"), "7px");
});

test("all seven reply layouts use taller rows while retaining native gutters and inset content", () => {
  const modes = ["off", "a", "b", "c", "d", "f", "h"];
  const native = `<style>
    .cell { padding: 10px; }
    .reply-threads-d > .cell[data-depth] { --tree-top: 6px; padding: 6px 10px 10px 68px; }
    .reply-threads-d > .cell[data-depth="0"] { --tree-top: 12px; padding-left: 10px; }
    .reply-threads-f.reply-lines-on > .cell[data-reply-id] { padding-left: 42px; }
    .reply-group > .reply-group-item { padding: 8px 0; }
    .reply-strip { padding: 4px 10px; }
    .reply-quote { padding: 6px 10px 8px; }
    .reply-threads-d { --tree-curve: 10px; --tree-bottom: 10px; }
  </style>`;
  const layouts = modes.map(
    (mode, index) => `<div class="box reply-threads reply-threads-${mode} reply-lines-on">
      <div class="cell" id="r_${index * 2 + 1}" data-reply-id="${index * 2 + 1}" data-depth="0">Root</div>
      <div class="cell" id="r_${index * 2 + 2}" data-reply-id="${index * 2 + 2}" data-depth="1">Answer
        <a class="reply-strip">Quote strip</a><div class="reply-quote">Stacked quote</div></div>
      <div class="reply-group"><div class="cell reply-group-item" id="r_${index + 200}">Nested answer</div></div>
      <div class="cell reply-ad">Ad</div></div>`,
  );
  dom(`<div id="Main">${layouts.join("")}</div><div id="Rightbar">
    <div class="box"><div class="cell" id="r_100">Outside the reply list</div></div></div>`);
  const style = document.createElement("style");
  style.textContent = compile("src/theme.scss").css;
  document.head.append(style);
  document.head.insertAdjacentHTML("beforeend", native);
  const computed = (node) => window.getComputedStyle(node);
  for (const mode of modes) {
    const box = document.querySelector(`.reply-threads-${mode}`);
    const [root, answer] = box.querySelectorAll(":scope > .cell[id]");
    for (const row of [root, answer]) {
      const actual = computed(row);
      assert.equal(actual.paddingTop, "15px", `${mode}: top`);
      assert.equal(actual.paddingBottom, "15px", `${mode}: bottom`);
      assert.equal(actual.paddingRight, "10px", `${mode}: right`);
      assert.equal(
        actual.paddingLeft,
        mode === "f" ? "42px" : row === answer && mode === "d" ? "68px" : "10px",
        `${mode}: native left gutter`,
      );
    }
    assert.equal(computed(box.querySelector(".reply-group-item")).padding, "8px 0px");
    assert.equal(computed(box.querySelector(".reply-strip")).padding, "4px 10px");
    assert.equal(computed(box.querySelector(".reply-quote")).padding, "6px 10px 8px");
    assert.equal(computed(box.querySelector(".reply-ad")).padding, "20px 10px");
    if (mode === "d") {
      assert.equal(computed(box).getPropertyValue("--tree-curve"), "0px");
      assert.equal(computed(box).getPropertyValue("--tree-bottom"), "15px");
      for (const row of [root, answer])
        assert.equal(computed(row).getPropertyValue("--tree-top"), "15px");
    }
  }
  assert.equal(computed(document.getElementById("r_100")).padding, "10px");
});

test("title preview is visible before hover and separated from the title", () => {
  dom(
    '<div id="Main"><div class="cell"><span class="item_title">Title</span><button class="v2p-topic-preview-btn vx-preview-visible">Preview</button></div></div>',
  );
  const style = document.createElement("style");
  style.textContent = compile("src/theme.scss").css + readFileSync("src/styles.css", "utf8");
  document.head.append(style);
  const computed = window.getComputedStyle(document.querySelector("button"));
  assert.equal(computed.visibility, "visible");
  assert.equal(computed.marginInlineStart, "8px");
});

test("native thank-area styles cannot hide the Polish action icons", () => {
  dom('<div class="thank_area v2p-controls"><a href="#">Action</a></div>');
  document.documentElement.dataset.v2pTheme = "minimalist";
  const style = document.createElement("style");
  style.textContent =
    compile("src/theme.scss").css +
    readFileSync("src/styles.css", "utf8") +
    ".thank_area{display:inline-block}.thank_area>a{visibility:hidden}";
  document.head.append(style);
  assert.equal(
    window.getComputedStyle(document.querySelector(".thank_area")).display,
    "inline-flex",
  );
  assert.equal(window.getComputedStyle(document.querySelector("a")).visibility, "visible");
  assert.equal(window.getComputedStyle(document.querySelector(".thank_area")).position, "relative");
  assert.equal(window.getComputedStyle(document.querySelector(".thank_area")).zIndex, "1");
});

test("theme keeps native V2EX reply typography and inner spacing on desktop and mobile", () => {
  dom(`<style>
    .box { padding: 0; }
    .cell { padding: 10px; font-size: 14px; line-height: 150%; }
    .reply_content { font-size: 14px; line-height: 1.6; }
    .ago { font-size: 11px; }
    .no { font-size: 9px; line-height: 9px; padding: 2px 5px; }
    .sep3 { height: 3px; }
  </style><div id="Wrapper"><div class="content"><div id="Main"><div class="box" id="replies"><div class="cell" id="r_1"><table><tbody><tr><td width="48"><img class="avatar" width="48"></td><td width="10"></td><td><div class="flex-one-row"><span class="ago">now</span><span class="no">1</span></div><div class="sep3"></div><div class="reply_content"><p>Native paragraph</p></div></td></tr></tbody></table></div></div></div></div></div>`);
  const selectors = [
    "#replies",
    "#r_1",
    ".reply_content",
    ".ago",
    ".no",
    ".sep3",
    "td",
    "img.avatar",
    ".reply_content p",
    ".flex-one-row",
  ];
  const properties = [
    "fontSize",
    "lineHeight",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "marginTop",
    "marginBottom",
    "width",
    "height",
  ];
  const metrics = () =>
    selectors.map((selector) => {
      const style = window.getComputedStyle(document.querySelector(selector));
      return properties
        .filter(
          (property) => selector !== "#r_1" || !["paddingTop", "paddingBottom"].includes(property),
        )
        .map((property) => style[property]);
    });
  const native = metrics();
  const style = document.createElement("style");
  style.textContent = compile("src/theme.scss").css;
  document.head.append(style);
  assert.deepEqual(metrics(), native);
  document.documentElement.dataset.v2pMobile = "true";
  assert.deepEqual(metrics(), native);
});

test("native reply groups remain visible through transparent reply items", () => {
  dom(`<style>
    .box { background-color: rgb(255, 255, 255); }
    .reply-group { background-color: rgb(247, 249, 251); }
  </style><div id="Main"><div class="box"><div class="cell" id="r_1">Normal reply</div><div class="reply-group"><div class="cell reply-group-item" id="r_2"><table><tbody><tr><td>Grouped reply</td></tr></tbody></table></div><div class="reply-group"><div class="cell reply-group-item" id="r_3">Nested group</div></div></div></div></div><div id="Rightbar"><div id="top_replies"><div class="cell" id="top_r_2">Popular reply</div></div></div>`);
  const items = ["#r_1", "#r_2", "#r_3", "#top_r_2"];
  const colors = () =>
    items.map(
      (selector) => window.getComputedStyle(document.querySelector(selector)).backgroundColor,
    );
  const native = colors();
  const style = document.createElement("style");
  style.textContent = compile("src/theme.scss").css;
  document.head.append(style);
  assert.deepEqual(colors(), native);
  assert.equal(
    window.getComputedStyle(document.querySelector("#r_2 table")).backgroundColor,
    "rgba(0, 0, 0, 0)",
  );
});

test("hot replies keep author and time on one line with normalized avatar columns", () => {
  dom(`<div id="Main"><div id="top_replies">
    <div class="cell vx-hot-reply"><div class="vr_wrapper"><table><tbody><tr>
      <td><img class="avatar"></td><td></td><td><div class="flex-one-row">
        <div class="flex-one-row"><strong>very-long-member-name</strong><span class="ago">1 天前</span></div>
        <div class="vx-hot-meta">2 · 7</div>
      </div></td>
    </tr></tbody></table></div></div>
  </div></div>`);
  const style = document.createElement("style");
  style.textContent = compile("src/vendor/rep/content.scss").css;
  document.head.append(style);
  const info = window.getComputedStyle(
    document.querySelector("#top_replies td > .flex-one-row > .flex-one-row"),
  );
  const author = window.getComputedStyle(document.querySelector("#top_replies strong"));
  const time = window.getComputedStyle(document.querySelector("#top_replies .ago"));
  assert.equal(info.flexWrap, "nowrap");
  assert.equal(author.flexGrow, "0");
  assert.equal(time.flexShrink, "0");
  assert.equal(time.whiteSpace, "nowrap");
});

test("tag filters use their grid columns instead of V2EX's fixed input width", () => {
  dom(`<style>.sl { width: 320px; }</style>
    <input class="sl" id="native">
    <div id="vx-settings-dialog"><div class="vx-tag-filters">
      <label>Search<input type="search"></label>
      <label>Tag group<select class="vx-tag-group"><option>All tags</option></select></label>
      <span class="vx-tag-count">1 tagged member</span>
    </div></div>`);
  const style = document.createElement("style");
  style.textContent = readFileSync("src/styles.css", "utf8");
  document.head.append(style);
  const computed = (selector) => window.getComputedStyle(document.querySelector(selector));
  assert.match(
    computed(".vx-tag-filters").gridTemplateColumns,
    /^repeat\(2, minmax\(0(?:px)?, 1fr\)\)$/,
  );
  assert.equal(computed(".vx-tag-filters input").width, "100%");
  assert.equal(computed(".vx-tag-group").width, "100%");
  assert.equal(computed(".vx-tag-count").gridColumn, "1 / -1");
  assert.equal(computed("#native").width, "320px");
});

test("image upload switch aligns with the Imgur Client ID heading", () => {
  dom(`<div id="vx-settings-dialog"><section id="vx-settings-panel-images">
    <div class="vx-settings-grid">
      <div class="vx-settings-option"><label>Image upload<input name="upload" type="checkbox"></label><p>Upload help</p></div>
      <div class="vx-settings-option"><label>Client ID<input name="imgurClientId" type="text"></label><p>Client help</p></div>
    </div>
  </section></div>`);
  const style = document.createElement("style");
  style.textContent = readFileSync("src/styles.css", "utf8");
  document.head.append(style);
  const upload = document.querySelector('[name="upload"]');
  const clientId = document.querySelector('[name="imgurClientId"]');
  const uploadOption = window.getComputedStyle(upload.closest(".vx-settings-option"));
  const clientOption = window.getComputedStyle(clientId.closest(".vx-settings-option"));
  const clientLabel = window.getComputedStyle(clientId.closest("label"));
  assert.equal(uploadOption.gridRow, "auto");
  assert.equal(uploadOption.gridTemplateRows, "auto auto");
  assert.equal(clientOption.gridColumn, "auto");
  assert.equal(clientLabel.gridTemplateRows, "32px auto");
});

test("post-list member tags paint above the topic metadata overlay", () => {
  dom(`<span class="topic_info" style="pointer-events: none">
    <div class="vx-tags v2p-reply-tags">Tag</div>
  </span><div class="reply"><div class="vx-tags v2p-reply-tags">Tag</div></div>`);
  const style = document.createElement("style");
  style.textContent = readFileSync("src/styles.css", "utf8");
  document.head.append(style);
  const list = window.getComputedStyle(document.querySelector(".topic_info .vx-tags"));
  const reply = window.getComputedStyle(document.querySelector(".reply .vx-tags"));
  assert.equal(list.pointerEvents, "auto");
  assert.equal(list.zIndex, "2");
  assert.equal(list.marginInlineStart, "8px");
  assert.equal(list.marginInlineEnd, "8px");
  assert.equal(list.lineHeight, reply.lineHeight);
});

test("editor text buttons follow the active theme's Reply button size and styling", () => {
  dom(`<style>
    #reply-box form { text-align: right; }
    #reply-box button { float: right; }
    #reply-box .reply-theme { height: 38px; padding: 0 24px; border: 2px solid blue; border-radius: 9px; }
  </style><div id="reply-box"><form>
    <textarea id="reply_content"></textarea>
    <button type="submit" class="normal button reply-theme">回复</button>
  </form></div>`);
  const style = document.createElement("style");
  style.textContent = readFileSync("src/styles.css", "utf8");
  document.head.append(style);
  const submit = document.querySelector('[type="submit"]');
  submit.getBoundingClientRect = () => ({ width: 76, height: 38 });
  const { append } = replyActions(document.querySelector("textarea"));
  for (let index = 0; index < 2; index++) {
    const control = document.createElement("button");
    control.className = "normal button vx-editor-action-button";
    control.textContent = index ? "图片" : "表情";
    append(control);
  }
  const actions = window.getComputedStyle(document.querySelector(".vx-reply-actions"));
  assert.equal(actions.display, "flex");
  assert.equal(actions.justifyContent, "flex-start");
  assert.equal(actions.textAlign, "start");
  assert.equal(actions.width, "100%");
  for (const control of document.querySelectorAll(".vx-editor-action-button")) {
    const computed = window.getComputedStyle(control);
    assert.equal(computed.cssFloat, "none");
    assert.equal(control.classList.contains("reply-theme"), true);
    assert.equal(computed.width, "76px");
    assert.equal(computed.height, "38px");
    assert.equal(computed.padding, "0px 24px");
    assert.equal(computed.borderRadius, "9px");
  }
});

test("topic editor actions follow a non-submit publication button", () => {
  dom(`<style>
    .topic-actions { text-align: right; }
    .publish-theme { float: right; height: 42px; padding: 0 20px; border-radius: 7px; }
  </style><form><textarea name="content"></textarea><div class="topic-actions">
    <input type="button" class="super normal button publish-theme" value="发布主题">
  </div></form>`);
  const style = document.createElement("style");
  style.textContent = readFileSync("src/styles.css", "utf8");
  document.head.append(style);
  const publish = document.querySelector('input[value="发布主题"]');
  publish.getBoundingClientRect = () => ({ width: 108, height: 42 });
  const { append } = replyActions(document.querySelector("textarea"));
  const control = document.createElement("button");
  control.className = "normal button vx-editor-action-button";
  control.textContent = "图片";
  append(control);
  const actions = window.getComputedStyle(document.querySelector(".vx-reply-actions"));
  const computed = window.getComputedStyle(control);
  assert.equal(actions.display, "flex");
  assert.equal(actions.justifyContent, "flex-start");
  assert.equal(computed.cssFloat, "none");
  assert.equal(control.classList.contains("publish-theme"), true);
  assert.equal(computed.width, "108px");
  assert.equal(computed.height, "42px");
  assert.equal(computed.padding, "0px 20px");
  assert.equal(computed.borderRadius, "7px");
});
