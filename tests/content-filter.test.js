import assert from "node:assert/strict";
import test from "node:test";
import { createContentFilter } from "../src/content-filter.js";
import { normalizeOptions } from "../src/storage.js";
import { dom } from "./helpers.js";

test("content filter collapses matching topic titles and can reveal them", () => {
  dom(`
    <div class="cell item" id="topic-row">
      <span class="item_title"><a href="/t/456">出售 AdVert 服务</a></span>
      <span class="topic_info">meta</span>
    </div>
  `);
  const filter = createContentFilter(
    normalizeOptions({
      contentFilter: true,
      filterTopics: true,
      filterReplies: false,
      filterMode: "collapse",
      filterKeywords: ["advert"],
    }),
  );
  filter.enhance(document);
  const row = document.querySelector("#topic-row");
  assert.equal(row.classList.contains("vx-filter-collapse"), true);
  const toggle = row.querySelector(".vx-filter-notice button");
  assert.equal(toggle.textContent, "显示内容");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  toggle.click();
  assert.equal(row.classList.contains("vx-filter-revealed"), true);
  assert.equal(toggle.textContent, "重新过滤");
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
});

test("reply filtering ignores nested reply text and clears stale matches", () => {
  dom(`
    <div class="cell" id="r_1">
      <div class="reply_content">safe parent</div>
      <div class="cell" id="r_2"><div class="reply_content">blocked child</div></div>
    </div>
  `);
  const filter = createContentFilter(
    normalizeOptions({
      contentFilter: true,
      filterTopics: false,
      filterReplies: true,
      filterMode: "collapse",
      filterKeywords: ["BLOCKED"],
    }),
  );
  filter.enhance(document);
  const parent = document.querySelector("#r_1");
  const child = document.querySelector("#r_2");
  assert.equal(parent.classList.contains("vx-content-filtered"), false);
  assert.equal(child.classList.contains("vx-filter-collapse"), true);
  child.querySelector(".reply_content").textContent = "now safe";
  filter.enhance(child);
  assert.equal(child.classList.contains("vx-content-filtered"), false);
  assert.equal(child.querySelector(".vx-filter-notice"), null);
});

test("hide mode removes matching replies without affecting disabled topic filtering", () => {
  dom(`
    <div class="cell item" id="topic-row"><span class="item_title"><a href="/t/456">spam topic</a></span></div>
    <div class="cell" id="r_10"><div class="reply_content">contains spam</div></div>
  `);
  createContentFilter(
    normalizeOptions({
      contentFilter: true,
      filterTopics: false,
      filterReplies: true,
      filterMode: "hide",
      filterKeywords: ["spam"],
    }),
  ).enhance(document);
  assert.equal(document.querySelector("#topic-row").hidden, false);
  assert.equal(document.querySelector("#r_10").hidden, true);
  assert.equal(document.querySelector("#r_10 .vx-filter-notice"), null);
});

test("multi-keyword filter escapes regex metacharacters and matches full-width Unicode text", () => {
  dom(`
    <div class="cell" id="r_1"><div class="reply_content">c++ (beta) [v1.0]</div></div>
    <div class="cell" id="r_2"><div class="reply_content">ＡＤＶＥＲＴ 推广</div></div>
    <div class="cell" id="r_3"><div class="reply_content">normal c plus plus</div></div>
  `);
  createContentFilter(
    normalizeOptions({
      contentFilter: true,
      filterTopics: false,
      filterReplies: true,
      filterMode: "collapse",
      filterKeywords: ["c++ (beta)", "advert", "[v2.0]?*"],
    }),
  ).enhance(document);
  assert.equal(document.querySelector("#r_1").classList.contains("vx-content-filtered"), true);
  assert.equal(document.querySelector("#r_2").classList.contains("vx-content-filtered"), true);
  assert.equal(document.querySelector("#r_3").classList.contains("vx-content-filtered"), false);
});
