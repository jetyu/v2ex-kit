import assert from "node:assert/strict";
import test from "node:test";
import { initReplies } from "../src/replies.js";
import { createStorage } from "../src/storage.js";
import {
  createTopicUnread,
  enhanceUnreadList,
  MAX_READ_HISTORY,
  READ_HISTORY_KEY,
  readRecord,
  replyNumericId,
  topicIdFromPath,
  topicReplyTotal,
  updateHistoryMap,
} from "../src/unread-replies.js";
import { dom, memoryAPI } from "./helpers.js";

test("unread helpers parse topic IDs, reply IDs, totals, and enforce LRU cap", () => {
  assert.equal(topicIdFromPath("/t/12345"), "12345");
  assert.equal(topicIdFromPath("/t/12345/"), "12345");
  assert.equal(topicIdFromPath("/go/python"), null);

  dom(`
    <div id="Main">
      <div class="box"><div class="header"><small class="gray">99 次点击</small></div></div>
      <div class="box"><div class="cell"><span class="gray">1,234 条回复 · 2026-11-24</span></div>
        <div class="cell" id="r_456"><span class="no">12</span></div>
      </div>
    </div>
  `);
  assert.equal(topicReplyTotal(document), 1234);
  assert.equal(replyNumericId(document.getElementById("r_456")), 456);
  assert.equal(replyNumericId(document.createElement("div")), 0);

  let history = {};
  for (let i = 1; i <= MAX_READ_HISTORY + 5; i++) {
    history = updateHistoryMap(history, String(i), { maxId: i, count: i, now: i * 10 });
  }
  assert.equal(Object.keys(history).length, MAX_READ_HISTORY);
  assert.equal(readRecord(history, "1"), null);
  assert.equal(readRecord(history, "6").maxId, 6);
  assert.equal(updateHistoryMap(history, "6", { maxId: 5, count: 5, now: 60 + 100 }), null);
  assert.ok(updateHistoryMap(history, "6", { maxId: 7, count: 6, now: 60 + 100 }));
});

test("first topic visit marks no unread replies and saves read progress when visible", () => {
  const { window } = dom(`
    <div id="Main">
      <div class="box" id="replies">
        <div class="cell"><span class="gray">2 条回复</span></div>
        <div class="cell" id="r_10"><strong><a href="/member/Alice">Alice</a></strong><span class="no">1</span><div class="reply_content">First</div></div>
        <div class="cell" id="r_11"><strong><a href="/member/Bob">Bob</a></strong><span class="no">2</span><div class="reply_content">Second</div></div>
      </div>
    </div>`);
  const store = createStorage(memoryAPI());
  const unread = createTopicUnread({ store, doc: document, now: () => 1000 });
  initReplies({ options: { unreadReplies: true }, enhance() {}, unread });
  assert.equal(document.querySelectorAll(".vx-reply-unread").length, 0);
  assert.equal(document.querySelector(".vx-unread-divider"), null);
  assert.equal(document.querySelector(".vx-unread-jump").hidden, true);
  assert.equal(unread.flush(), true);
  assert.deepEqual(store.get(READ_HISTORY_KEY)["123"], [11, 2, 1000]);
  unread.destroy();
  window.close();
});

test("background tabs are not marked read until visible", () => {
  const { window } = dom(`
    <div id="Main"><div class="box" id="replies">
      <div class="cell" id="r_10"><strong><a href="/member/Alice">Alice</a></strong><span class="no">1</span></div>
    </div></div>`);
  let visible = "hidden";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visible });
  const store = createStorage(memoryAPI());
  const unread = createTopicUnread({ store, doc: document, now: () => 2000 });
  initReplies({ options: { unreadReplies: true }, enhance() {}, unread });
  window.dispatchEvent(new window.Event("pagehide"));
  assert.equal(store.get(READ_HISTORY_KEY), undefined);

  const { window: window2 } = dom(`
    <div id="Main"><div class="box" id="replies">
      <div class="cell" id="r_10"><strong><a href="/member/Alice">Alice</a></strong><span class="no">1</span></div>
    </div></div>`);
  let state2 = "hidden";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state2 });
  const unread2 = createTopicUnread({ store, doc: document, now: () => 2000 });
  initReplies({ options: { unreadReplies: true }, enhance() {}, unread: unread2 });
  state2 = "visible";
  document.dispatchEvent(new window2.Event("visibilitychange"));
  state2 = "hidden";
  document.dispatchEvent(new window2.Event("visibilitychange"));
  assert.deepEqual(store.get(READ_HISTORY_KEY)["123"], [10, 1, 2000]);
  unread2.destroy();
  window.close();
  window2.close();
});

test("revisiting a topic highlights unread replies, skips own reply, and jumps between new replies", () => {
  const { window } = dom(`
    <div id="Main">
      <div class="box"><div class="header"><h1>T</h1><small class="gray"><a href="/member/Alice">Alice</a></small></div></div>
      <div class="box" id="replies">
        <div class="cell"><span class="gray">4 条回复</span></div>
        <div class="cell" id="r_10"><strong><a href="/member/Alice">Alice</a></strong><span class="no">1</span><div class="reply_content">Old</div></div>
        <div class="cell" id="r_11"><strong><a href="/member/Bob">Bob</a></strong><span class="no">2</span><div class="reply_content">Unread 1</div></div>
        <div class="cell" id="r_12"><strong><a href="/member/reader">reader</a></strong><span class="no">3</span><div class="reply_content">Self</div></div>
        <div class="cell" id="r_13"><strong><a href="/member/Carol">Carol</a></strong><span class="no">4</span><div class="reply_content">Unread 2</div></div>
      </div>
    </div>`);
  const store = createStorage(memoryAPI());
  store.set(READ_HISTORY_KEY, { 123: [10, 1, 500] });
  const scrolled = [];
  window.HTMLElement.prototype.scrollIntoView = function () {
    scrolled.push(this.id);
  };
  const unread = createTopicUnread({
    store,
    doc: document,
    currentAccount: "reader",
    now: () => 1500,
  });
  initReplies({
    options: { onlyOp: true, unreadReplies: true },
    enhance() {},
    unread,
  });
  assert.deepEqual(
    [...document.querySelectorAll(".vx-reply-unread")].map((node) => node.id),
    ["r_11", "r_13"],
  );
  assert.equal(document.querySelector("#r_12 .vx-unread-badge"), null);
  assert.equal(document.querySelector("#r_11 .vx-unread-badge").textContent, "新回复");
  const divider = document.querySelector(".vx-unread-divider");
  assert.equal(divider.nextElementSibling.id, "r_11");
  const jump = document.querySelector(".vx-unread-jump");
  assert.equal(jump.hidden, false);
  assert.equal(jump.textContent, "2 条新回复");

  assert.equal(document.querySelector(".vx-only-op-btn"), null);
  jump.click();
  jump.click();
  assert.deepEqual(scrolled, ["r_11", "r_13"]);
  assert.equal(unread.flush(), true);
  assert.deepEqual(store.get(READ_HISTORY_KEY)["123"], [13, 4, 1500]);
  unread.destroy();
  window.close();
});

test("preloaded pages do not mark unread replies read until navigated", async () => {
  const { window } = dom(`
    <div id="Main"><div class="box" id="replies">
      <div class="cell"><a class="page_normal" href="/t/123?p=1">1</a><a class="page_normal" href="/t/123?p=2">2</a></div>
      <div class="cell" id="r_10"><strong><a href="/member/Alice">Alice</a></strong><span class="no">1</span></div>
    </div></div>`);
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const store = createStorage(memoryAPI());
  store.set(READ_HISTORY_KEY, { 123: [5, 1, 100] });
  const unread = createTopicUnread({ store, doc: document, totalPages: 2, now: () => 500 });
  const module = initReplies({
    options: { preloadPages: 1, unreadReplies: true },
    enhance() {},
    unread,
    getDocument: async () =>
      new DOMParser().parseFromString(
        `<div id="Main"><div class="cell" id="r_200"><strong><a href="/member/Bob">Bob</a></strong><span class="no">101</span></div></div>`,
        "text/html",
      ),
  });
  await module.preload();
  unread.flush();
  assert.deepEqual(store.get(READ_HISTORY_KEY)["123"], [10, 1, 500]);
  assert.equal(document.querySelector("#r_200").dataset.vxUnread, "1");

  await module.paging.navigate(2);
  unread.flush();
  assert.deepEqual(store.get(READ_HISTORY_KEY)["123"], [200, 101, 500]);
  unread.destroy();
  window.close();
});

test("enhanceUnreadList marks list rows with new replies and leaves unchanged topics clean", () => {
  dom(`
    <div id="Main">
      <div class="cell item" id="row-new">
        <span class="item_title"><a class="topic-link" href="/t/100#reply12">Updated topic</a></span>
        <span class="topic_info">meta</span>
        <a class="count_livid" href="/t/100#reply12">12</a>
      </div>
      <div class="cell item" id="row-same">
        <span class="item_title"><a class="topic-link" href="/t/101#reply5">Seen topic</a></span>
        <span class="topic_info">meta</span>
        <a class="count_livid" href="/t/101#reply5">5</a>
      </div>
      <div class="cell item" id="row-fresh">
        <span class="item_title"><a class="topic-link" href="/t/102#reply8">Never visited</a></span>
        <span class="topic_info">meta</span>
        <a class="count_livid" href="/t/102#reply8">8</a>
      </div>
    </div>`);
  const store = createStorage(memoryAPI());
  store.set(READ_HISTORY_KEY, {
    100: [500, 7, 1000],
    101: [600, 5, 1000],
  });
  enhanceUnreadList(document, store);
  enhanceUnreadList(document, store);
  const badge = document.querySelectorAll("#row-new .vx-list-unread");
  assert.equal(badge.length, 1);
  assert.equal(badge[0].textContent, "+5 新");
  assert.equal(document.querySelector("#row-same .vx-list-unread"), null);
  assert.equal(document.querySelector("#row-fresh .vx-list-unread"), null);
});
