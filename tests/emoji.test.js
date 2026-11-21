import assert from "node:assert/strict";
import test from "node:test";
import { enhanceEmojis, initEmoji, transformEmoji } from "../src/emoji.js";
import groups from "../src/vendor/polish/emoticons.json" with { type: "json" };
import { dom } from "./helpers.js";

test("Polish emoji groups retain image tokens and native emoji", () => {
  assert.equal(groups.length, 5);
  const image = groups[0].items[0];
  assert.equal(
    transformEmoji(`before ${image.value} after [unknown]`),
    `before ${image.url}  after [unknown]`,
  );
  dom(`<img class="embedded_image" src="${image.url}">`);
  enhanceEmojis(document);
  assert.equal(document.querySelector("img").src, image.url);
  assert.equal(document.querySelector("img").classList.contains("v2p-emoji-img"), true);
});

test("emoji picker preserves the current selection and draft", async () => {
  dom(
    '<div id="reply-box"><form><textarea id="reply_content">before after</textarea><button type="submit">Reply</button></form></div>',
  );
  const textarea = document.querySelector("textarea");
  textarea.setSelectionRange(7, 7);
  initEmoji({ emoji: true });
  const trigger = document.querySelector('[aria-label="\u63d2\u5165\u8868\u60c5"]');
  assert.equal(trigger.classList.contains("vx-editor-action-button"), true);
  assert.equal(trigger.textContent, "表情");
  assert.equal(trigger.querySelector("svg"), null);
  trigger.click();
  assert.equal(document.querySelectorAll(".v2p-emoji-group").length, 5);
  const face = groups[1].items[0].value;
  const choice = [...document.querySelectorAll(".v2p-emoji")].find((node) => node.title === face);
  choice.click();
  assert.equal(textarea.value, `before ${face}after`);
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.querySelector(".v2p-popup").hidden, true);
  await new Promise(setImmediate);
});

test("topic emoji entry shares the publication action and converts tokens before its click", () => {
  dom(`<form><textarea name="content">[doge]</textarea><div class="topic-actions">
    <input type="button" class="super normal button publish-theme" value="发布主题">
  </div></form>`);
  const publish = document.querySelector('input[value="发布主题"]');
  let publishedContent;
  publish.addEventListener(
    "click",
    () => (publishedContent = document.querySelector("textarea").value),
  );
  initEmoji({ emoji: true });
  const trigger = document.querySelector('[aria-label="插入表情"]');
  assert.equal(publish.parentElement.className, "vx-reply-actions");
  assert.equal(publish.nextElementSibling, trigger);
  assert.equal(trigger.classList.contains("publish-theme"), true);
  publish.click();
  assert.notEqual(publishedContent, "[doge]");
  assert.match(publishedContent, /^https:\/\//);
});

test("topic emoji waits for an asynchronously rendered publication control outside the form", async () => {
  dom(
    '<div id="Main"><form><textarea name="content"></textarea></form><div id="footer"></div></div>',
  );
  initEmoji({ emoji: true });
  assert.equal(document.querySelector('[aria-label="插入表情"]'), null);
  document
    .querySelector("#footer")
    .insertAdjacentHTML(
      "beforeend",
      '<button type="button" class="normal button">发布主题</button>',
    );
  await new Promise(setImmediate);
  const publish = document.querySelector("#footer button");
  const trigger = document.querySelector('[aria-label="插入表情"]');
  assert.equal(publish.parentElement.className, "vx-reply-actions");
  assert.equal(trigger.parentElement, publish.parentElement);
  assert.equal(publish.nextElementSibling, trigger);
});
