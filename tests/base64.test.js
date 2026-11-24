import assert from "node:assert/strict";
import test from "node:test";
import { decodeBase64, enhanceBase64 } from "../src/base64.js";
import { dom } from "./helpers.js";

test("valid UTF-8 Base64 is decoded while binary and malformed values are ignored", () => {
  assert.equal(decodeBase64("SGVsbG8sIFYyRVgh"), "Hello, V2EX!");
  assert.equal(decodeBase64("5L2g5aW977yMVjJFWCE="), "你好，V2EX!");
  assert.equal(decodeBase64("8J+YgCB0ZXN0"), "😀 test");
  assert.equal(decodeBase64("not-base64"), null);
  assert.equal(decodeBase64("AAAA"), null);
  assert.equal(decodeBase64("function"), null);
  assert.equal(decodeBase64("document"), null);
  assert.equal(decodeBase64("response"), null);
  assert.equal(decodeBase64("wIABAA=="), null); // overlong UTF-8
  assert.equal(decodeBase64("7aCAAA=="), null); // UTF-16 surrogate
  assert.equal(decodeBase64("SGVsbG8A"), null); // embedded NUL
  assert.equal(decodeBase64("SGVsbG8B"), null); // control char 0x01
  assert.equal(decodeBase64("SGVsbG8J"), "Hello\t");
});

test("topic and reply Base64 text is replaced without touching code or links", () => {
  dom(`
    <div class="topic_content">内容：SGVsbG8sIFYyRVgh</div>
    <div class="reply_content">5L2g5aW977yMVjJFWCE= <code>SGVsbG8sIFYyRVgh</code></div>
    <a href="/t/1">SGVsbG8sIFYyRVgh</a>
  `);
  enhanceBase64(document);
  const decoded = [...document.querySelectorAll(".v2p-decode")];
  assert.deepEqual(
    decoded.map((node) => node.textContent),
    ["Hello, V2EX!", "你好，V2EX!"],
  );
  assert.equal(decoded[0].title, "SGVsbG8sIFYyRVgh");
  assert.equal(document.querySelector("code").textContent, "SGVsbG8sIFYyRVgh");
  assert.equal(document.querySelector("a").textContent, "SGVsbG8sIFYyRVgh");
  enhanceBase64(document);
  assert.equal(document.querySelectorAll(".v2p-decode").length, 2);

  // Mutated text nodes are re-scanned even if previously visited.
  const dynamic = document.createElement("div");
  dynamic.className = "reply_content";
  dynamic.textContent = "plain text";
  document.body.append(dynamic);
  enhanceBase64(dynamic);
  assert.equal(dynamic.querySelectorAll(".v2p-decode").length, 0);
  dynamic.firstChild.data = "SGVsbG8sIFYyRVgh";
  enhanceBase64(dynamic);
  assert.equal(dynamic.querySelector(".v2p-decode").textContent, "Hello, V2EX!");
});
