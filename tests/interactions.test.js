import assert from "node:assert/strict";
import test from "node:test";
import { createTopics } from "../src/preview.js";
import { createMembers } from "../src/members.js";
import { openSettings } from "../src/settings.js";
import { installPageActions } from "../src/page-actions.js";
import { t } from "../src/i18n.js";
import { createStorage } from "../src/storage.js";
import { enhanceImages, installImageViewer } from "../src/image-viewer.js";
import { dom, memoryAPI } from "./helpers.js";

test("reply shortcut floats the existing draft when the native helper is unavailable", () => {
  const { window } = dom(`<div id="Main"><div id="reply-box">
    <button id="undock-button" style="display:none">Undock</button>
    <textarea id="reply_content">Existing draft</textarea>
    </div></div>`);
  const editor = document.querySelector("#reply_content");
  editor.scrollIntoView = () => assert.fail("opening a floating reply must not scroll");
  window.scrollTo = () => assert.fail("opening a floating reply must not scroll");
  editor.setSelectionRange(2, 5);
  installPageActions(true, {});
  const reply = document.querySelector(".vx-quick-reply");
  const box = document.querySelector("#reply-box");
  reply.click();
  assert.equal(box.classList.contains("reply-box-sticky"), true);
  assert.equal(document.querySelector("#undock-button").style.display, "inline-block");
  assert.equal(document.activeElement, editor);
  assert.equal(editor.value, "Existing draft");
  assert.equal(editor.selectionStart, 2);
  assert.equal(editor.selectionEnd, 5);
  box.classList.remove("reply-box-sticky");
  reply.click();
  assert.equal(box.classList.contains("reply-box-sticky"), true);
  window.close();
});

test("topic preview shows sanitized excerpts and reuses the fetched topic", async () => {
  const { window } = dom('<span class="item_title"><a href="/t/456">Topic</a></span>');
  const fetched = [];
  const topics = createTopics({ preview: true, newTab: true }, async (path) => {
    fetched.push(path);
    return new DOMParser().parseFromString(
      `
      <div id="Top">Header</div><div id="Main">
        <div class="header"><h1>Fetched topic</h1></div>
        <div class="topic_content"><p onclick="alert(1)">Body <a href="/member/author">Author</a></p>
          <img src="/photo.png"><script>alert(1)</script></div>
        <div class="subtle"><div class="markdown_body">Supplement one</div></div>
        <div class="subtle"><div class="topic_content">Supplement two</div></div>
        <div class="reply_content">Reply text</div><textarea>Draft</textarea>
      </div>`,
      "text/html",
    );
  });
  topics.enhance(document);
  topics.enhance(document);
  const preview = document.querySelector(".v2p-topic-preview-btn");
  assert.equal(document.querySelectorAll(".v2p-topic-preview-btn").length, 1);
  assert.equal(document.querySelector(".item_title").nextElementSibling, preview);
  for (let visit = 0; visit < 2; visit++) {
    preview.click();
    assert.equal(document.querySelector(".v2p-topic-preview").getAttribute("aria-busy"), "true");
    await new Promise(setImmediate);
    const dialog = document.querySelector(".vx-topic-excerpt");
    assert.equal(dialog.querySelector(".v2p-modal-title").textContent, "Fetched topic");
    assert.deepEqual(
      [...dialog.querySelectorAll(".topic_content")].map((node) => node.textContent.trim()),
      ["Body Author", "Supplement one", "Supplement two"],
    );
    assert.equal(dialog.querySelector("iframe, textarea, script, [onclick]"), null);
    const author = dialog.querySelector(".topic_content a");
    assert.equal(author.href, "https://www.v2ex.com/member/author");
    assert.equal(author.target, "_blank");
    dialog.querySelector(".topic_content img").click();
    assert.ok(document.querySelector(".vx-image-viewer"));
    assert.equal(dialog.hasAttribute("inert"), true);
    document.querySelector(".vx-image-viewer .v2p-modal-close-btn").click();
    dialog.querySelector(".v2p-modal-close-btn").click();
  }
  assert.deepEqual(fetched, ["/t/456"]);
  window.close();
});

test("failed topic previews can be retried after closing the dialog", async () => {
  const { window } = dom('<span class="item_title"><a href="/t/456">Topic</a></span>');
  let attempts = 0;
  createTopics({ preview: true }, async () => {
    if (++attempts === 1) throw new Error("Request failed");
    return new DOMParser().parseFromString('<div id="Main"><h1>Recovered</h1></div>', "text/html");
  }).enhance(document);
  const preview = document.querySelector(".v2p-topic-preview-btn");
  preview.click();
  await new Promise(setImmediate);
  assert.match(document.querySelector(".v2p-topic-preview").textContent, /Request failed/);
  document.querySelector(".v2p-modal-close-btn").click();
  preview.click();
  await new Promise(setImmediate);
  assert.equal(document.querySelector(".v2p-modal-title").textContent, "Recovered");
  assert.equal(attempts, 2);
  window.close();
});

test("topic images open in place while ordinary links and emoji keep their behavior", () => {
  const { window } = dom(`<div id="Main"><div class="topic_content">
    <img id="plain" src="/plain.png" alt="Screenshot">
    <a id="linked" href="/full.png" target="_blank"><img src="/thumbnail.png"></a>
    <a id="website" href="/member/Alice" target="_blank"><img src="/logo.png"></a>
    <img id="emoji" class="v2p-emoji-img" src="/emoji.png">
  </div></div>`);
  const main = document.getElementById("Main");
  installImageViewer(main);
  enhanceImages(main);
  const plain = document.getElementById("plain");
  assert.equal(plain.tabIndex, 0);
  assert.equal(plain.getAttribute("role"), "button");
  assert.equal(document.getElementById("emoji").hasAttribute("tabindex"), false);

  plain.focus();
  const press = (node, key) =>
    node.dispatchEvent(
      new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  assert.equal(press(plain, "Enter"), false);
  const viewer = () => document.querySelector(".vx-image-viewer");
  assert.equal(viewer().querySelector("img").src, "https://www.v2ex.com/plain.png");
  assert.equal(viewer().querySelector("img").alt, "Screenshot");
  press(document, "Escape");
  assert.equal(viewer(), null);
  assert.equal(document.activeElement, plain);

  document.getElementById("linked").click();
  const large = viewer().querySelector("img");
  assert.equal(large.src, "https://www.v2ex.com/full.png");
  large.dispatchEvent(new window.Event("error"));
  assert.equal(large.src, "https://www.v2ex.com/thumbnail.png");
  large.dispatchEvent(new window.Event("error"));
  assert.ok(viewer().querySelector('[role="status"]'));
  press(document, "Escape");

  document.querySelector("#website img").click();
  document.getElementById("emoji").click();
  assert.equal(viewer(), null);
  main.insertAdjacentHTML("beforeend", '<div class="reply_content"><img src="/new.png"></div>');
  main.querySelector(".reply_content img").click();
  assert.equal(viewer().querySelector("img").src, "https://www.v2ex.com/new.png");
  press(document, "Escape");
  window.close();
});

test("editing one member updates all visible instances without duplicate controls", () => {
  dom(
    '<div id="Main"><strong><a href="/member/Alice">Alice</a></strong><strong><a href="/member/Alice">Alice</a></strong></div>',
  );
  const api = memoryAPI();
  const store = createStorage(api);
  const members = createMembers(store, { tags: true, userCards: false });
  members.enhance(document);
  members.enhance(document);
  assert.equal(document.querySelectorAll(".vx-tags").length, 2);
  members.edit("Alice");
  document.querySelector(".v2p-modal-content textarea").value = "backend, database";
  [...document.querySelectorAll(".v2p-modal-main button")]
    .find((node) => node.textContent === "\u4fdd\u5b58\u6807\u7b7e")
    .click();
  assert.deepEqual(store.getTags("alice"), ["backend", "database"]);
  assert.equal(document.querySelectorAll(".v2p-reply-tags:not([hidden])").length, 2);
  assert.equal(document.querySelectorAll(".vx-tags button").length, 0);
  assert.match(document.querySelector(".v2p-reply-tags").textContent, /backend/);
  assert.equal(api.writes.length, 1);
});

test("tags retain the Polish header and inline reply positions", () => {
  dom(
    '<div id="Main"><div class="header"><a href="/member/Alice">Alice</a></div><div class="cell" id="r_1"><table><tbody><tr><td><div class="flex-one-row"><strong><a href="/member/Alice">Alice</a></strong><div class="badges"></div><span class="ago">now</span></div><div class="reply_content">Body</div></td></tr></tbody></table></div></div>',
  );
  const store = createStorage(memoryAPI());
  store.setTags("Alice", ["backend"]);
  createMembers(store, { tags: true, userCards: false }).enhance(document);
  assert.equal(
    document.querySelector(".header").lastElementChild.classList.contains("v2p-reply-tags"),
    true,
  );
  assert.equal(
    document
      .querySelector(".badges")
      .previousElementSibling.classList.contains("v2p-reply-tags-inline"),
    true,
  );
  assert.equal(document.querySelector("strong .v2p-reply-tags"), null);
  assert.equal(document.querySelector("#r_1 .v2p-reply-tags b").textContent, "#");
});

test("topic lists show one author tag when author and latest replier links repeat", () => {
  dom(`<div id="Main">
    <div class="cell item"><span class="topic_info">
      <strong><a href="/member/burnsby">burnsby</a></strong><span>Today</span>
      <strong><a href="/member/burnsby">burnsby</a></strong>
    </span></div>
    <div class="cell item"><span class="topic_info">
      <strong><a href="/member/burnsby">burnsby</a></strong><span>Yesterday</span>
      <strong><a href="/member/Alice">Alice</a></strong>
    </span></div></div>`);
  const store = createStorage(memoryAPI());
  store.setTags("burnsby", ["Test"]);
  store.setTags("Alice", ["Another member"]);
  const members = createMembers(store, { tags: true, userCards: false });
  members.enhance(document);
  members.enhance(document);
  for (const info of document.querySelectorAll(".topic_info")) {
    members.enhance(info.querySelector("strong:last-of-type a"));
    assert.equal(info.querySelectorAll(".vx-tags").length, 1);
    assert.equal(info.querySelector("strong").nextElementSibling, info.querySelector(".vx-tags"));
    assert.equal(info.querySelector(".vx-tags").title, "Test");
  }
});

test("settings edit and delete saved tags without submitting the settings form", async () => {
  const { window } = dom('<div id="Main"><strong><a href="/member/Alice">Alice</a></strong></div>');
  const api = memoryAPI();
  const store = createStorage(api);
  store.import(
    `{"schema":1,"members":{"Alice":["Database","Research, Development"],"Bob":["UX"],"Former":[]}}`,
  );
  for (let i = 0; i < 49; i++) store.setTags(`test-${i}`, ["example"]);
  const members = createMembers(store, { tags: true, userCards: false });
  members.enhance(document);
  openSettings(store, false, members);
  const details = document.querySelector(".vx-settings-tag-manager");
  assert.equal(details.querySelector("summary").textContent, t("manageTags"));
  assert.equal(details.querySelector("input"), null);
  await new Promise((resolve) => {
    details.addEventListener("toggle", resolve, { once: true });
    details.open = true;
  });
  const list = details.querySelector(".vx-tag-list");
  const manager = details.querySelector(".vx-tag-manager");
  const group = details.querySelector(".vx-tag-group");
  assert.match(manager.textContent, /20.*80.*20,000/);
  assert.match(manager.textContent, new RegExp(t("taggedCount", 51)));
  assert.equal(list.children.length, 50);
  manager.lastElementChild.click();
  assert.equal(list.children.length, 51);
  assert.doesNotMatch(list.textContent, /Former/i);
  const search = details.querySelector('input[type="search"]');
  const query = (value) => {
    search.value = value;
    search.dispatchEvent(new Event("input", { bubbles: true }));
  };
  assert.match([...group.options].find((option) => option.value === "example").textContent, /49/);
  group.value = "Database";
  group.dispatchEvent(new Event("change"));
  assert.equal(list.children.length, 1);
  assert.equal(manager.querySelector(".vx-tag-count").textContent, t("filteredTaggedCount", 1, 51));
  query("BOB");
  assert.equal(list.textContent, t("noMatchingTags"));
  query("");
  const matchingChip = [...list.querySelectorAll(".vx-tag-filter")].find(
    (chip) => chip.textContent === "Research, Development",
  );
  matchingChip.click();
  assert.equal(group.value, "Research, Development");
  assert.equal(list.querySelector('[aria-pressed="true"]').textContent, "Research, Development");
  group.value = "Database";
  group.dispatchEvent(new Event("change"));
  query("DATABASE");
  assert.equal(list.children.length, 1);
  assert.match(list.textContent, /alice.*Database/);
  const profile = list.querySelector(".vx-tag-profile");
  assert.equal(profile.href, "https://www.v2ex.com/member/alice");
  assert.equal(profile.target, "_blank");
  assert.equal(
    search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", cancelable: true })),
    false,
  );
  list.querySelector(".vx-tag-actions button").click();
  const input = details.querySelector(".vx-tag-fields textarea");
  const entry = details.querySelector(".vx-tag-entry textarea");
  assert.equal(details.querySelector(".vx-tag-input .sl"), null);
  assert.equal(input.value, "Database");
  const save = [...details.querySelectorAll("button")].find(
    (button) => button.textContent === t("saveTags"),
  );
  entry.value = "x".repeat(81);
  save.click();
  assert.equal(details.querySelector('[role="alert"]').textContent, t("tagFormat", 80));
  assert.deepEqual(store.getTags("alice"), ["Database", "Research, Development"]);
  entry.select();
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", {
    value: { getData: () => "UI, Browser\nDatabase" },
  });
  entry.dispatchEvent(paste);
  assert.equal(paste.defaultPrevented, true);
  assert.deepEqual(
    [...details.querySelectorAll(".vx-tag-fields textarea")].map((field) => field.value),
    ["Database", "Research, Development", "UI", "Browser"],
  );
  const [first, , third] = details.querySelectorAll(".vx-tag-field");
  const editTag = first.querySelector(".vx-tag-edit-value");
  const rename = first.querySelector("textarea");
  assert.equal(rename.hidden, true);
  editTag.click();
  assert.equal(rename.hidden, false);
  rename.value = "Discard";
  rename.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  assert.equal(editTag.textContent, "Database");
  editTag.click();
  rename.value = "Backend";
  rename.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
  );
  assert.equal(editTag.textContent, "Backend");
  third.querySelector(".vx-tag-remove-value").click();
  entry.value = "Comma";
  entry.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: ",", bubbles: true, cancelable: true }),
  );
  assert.equal(entry.value, "");
  entry.value = "Pending";
  save.click();
  assert.match(document.querySelector("#Main .vx-tags").textContent, /Backend/);
  assert.equal(details.querySelector('[role="status"]').textContent, t("tagsSaved", "alice"));
  assert.deepEqual(store.getTags("alice"), [
    "Backend",
    "Research, Development",
    "Browser",
    "Comma",
    "Pending",
  ]);
  assert.equal(group.value, "");
  assert.ok([...group.options].some((option) => option.value === "Backend"));
  query("ALICE");
  assert.match(list.textContent, /alice.*Backend/);
  const remove = list.querySelector(".vx-tag-delete");
  window.confirm = () => false;
  remove.click();
  assert.match(list.textContent, /alice.*Backend/);
  window.confirm = (message) => message === t("confirmDeleteTags", "alice");
  remove.click();
  assert.equal(list.textContent, t("noMatchingTags"));
  assert.equal(manager.querySelector(".vx-tag-count").textContent, t("filteredTaggedCount", 0, 50));
  assert.equal(document.querySelector("#Main .vx-tags").hidden, true);
  assert.equal(store.import('{"schema":1,"members":{"Alice":["old"]}}'), 0);
  assert.equal(
    api.writes.some((write) => write.endsWith(":options")),
    false,
  );
  document.querySelector(".v2p-modal-close-btn").click();
  window.close();
});
