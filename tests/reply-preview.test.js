import assert from "node:assert/strict";
import test from "node:test";
import { initReplyPreview, renderReplyPreview } from "../src/reply-preview.js";
import groups from "../src/vendor/polish/emoticons.json" with { type: "json" };
import { dom } from "./helpers.js";

test("reply editor switches between editing and a safe formatted preview", () => {
  dom(`
    <main id="Main">
      <form id="reply-box">
        <textarea id="reply_content" name="content"></textarea>
        <button type="submit">回复</button>
      </form>
    </main>
  `);
  const controls = initReplyPreview({ replyPreview: true });
  controls.textarea.getBoundingClientRect = () => ({ width: 638.5, height: 176.25 });
  controls.textarea.value =
    "你好 @Alice，请看 /t/456 和 https://example.com/page。\nhttps://i.imgur.com/demo.png";
  controls.preview.click();

  assert.equal(controls.textarea.hidden, true);
  assert.equal(controls.output.hidden, false);
  assert.equal(controls.output.style.width, "638.5px");
  assert.equal(controls.output.style.maxWidth, "638.5px");
  assert.equal(controls.output.style.height, "176.25px");
  assert.equal(controls.output.style.minHeight, "0px");
  assert.equal(controls.output.hasAttribute("contenteditable"), false);
  assert.equal(controls.preview.getAttribute("aria-selected"), "true");
  assert.equal(
    controls.output.querySelector('a[href="https://www.v2ex.com/member/Alice"]')?.textContent,
    "@Alice",
  );
  assert.equal(
    controls.output.querySelector('a[href="https://www.v2ex.com/t/456"]')?.textContent,
    "/t/456",
  );
  assert.equal(
    controls.output.querySelector('a[href="https://example.com/page"]')?.textContent,
    "https://example.com/page",
  );
  const image = controls.output.querySelector('img[src="https://i.imgur.com/demo.png"]');
  assert.ok(image);
  assert.equal(image.referrerPolicy, "no-referrer");
  assert.equal(image.closest("a").rel, "noopener noreferrer");

  controls.edit.click();
  assert.equal(controls.textarea.hidden, false);
  assert.equal(controls.output.hidden, true);
  assert.equal(document.activeElement, controls.textarea);
  assert.match(controls.textarea.value, /@Alice/);

  controls.textarea.getBoundingClientRect = () => ({ width: 520, height: 240 });
  controls.preview.click();
  assert.equal(controls.output.style.width, "520px");
  assert.equal(controls.output.style.maxWidth, "520px");
  assert.equal(controls.output.style.height, "240px");
  assert.equal(controls.output.classList.contains("reply_content"), false);
});

test("preview updates while active, preserves line breaks, and never creates unsafe links", () => {
  dom('<form id="reply-box"><textarea id="reply_content"></textarea></form>');
  const controls = initReplyPreview({ replyPreview: true });
  controls.preview.click();
  controls.textarea.value = "第一行\n第二行 javascript:alert(1) http://example.com/a.jpg";
  controls.textarea.dispatchEvent(new Event("input", { bubbles: true }));

  assert.equal(controls.output.textContent, controls.textarea.value);
  assert.equal(controls.output.querySelector('a[href^="javascript:"]'), null);
  assert.equal(controls.output.querySelector("img"), null, "insecure HTTP images stay links");
  assert.equal(
    controls.output.querySelector('a[href="http://example.com/a.jpg"]').textContent,
    "http://example.com/a.jpg",
  );
});

test("preview renders supported emoji tokens as the same emoji images used in replies", () => {
  dom('<form id="reply-box"><textarea id="reply_content"></textarea></form>');
  const controls = initReplyPreview({ replyPreview: true });
  const items = groups.flatMap((group) => group.items);
  const doge = items.find((item) => item.value === "[doge]");
  const wow = items.find((item) => item.value === "[哇R]");
  controls.textarea.value = `开始 ${wow.value} ${doge.value} [unknown] 结束`;
  controls.preview.click();

  const emojis = [...controls.output.querySelectorAll("img.v2p-emoji-img")];
  assert.deepEqual(
    emojis.map((image) => [image.alt, image.src]),
    [
      [wow.value, wow.image],
      [doge.value, doge.image],
    ],
  );
  assert.equal(
    emojis.every((image) => image.classList.contains("embedded_image")),
    true,
  );
  assert.equal(
    emojis.every((image) => image.style.width === "var(--v2p-emoji-size)"),
    true,
  );
  assert.match(controls.output.textContent, /\[unknown\]/);
  assert.equal(
    [...controls.output.querySelectorAll("a")].some((anchor) => anchor.textContent === "[unknown]"),
    false,
  );
  assert.doesNotMatch(controls.output.textContent, /\[哇R\]|\[doge\]/);
});

test("empty, disabled, and repeated initialization remain stable", () => {
  dom('<form id="reply-box"><textarea id="reply_content"></textarea></form>');
  assert.equal(initReplyPreview({ replyPreview: false }), null);
  const controls = initReplyPreview({ replyPreview: true });
  controls.preview.click();
  assert.equal(controls.output.textContent, "输入回复内容后在这里预览。");
  assert.equal(initReplyPreview({ replyPreview: true }), null);
  assert.equal(document.querySelectorAll(".v2p-lite-reply-tabs").length, 1);

  const standalone = document.createElement("div");
  renderReplyPreview(standalone, "@Bob");
  assert.equal(standalone.querySelector("a").href, "https://www.v2ex.com/member/Bob");
});
