import assert from "node:assert/strict";
import test from "node:test";
import {
  createUploadHistory,
  initUpload,
  replacePlaceholder,
  uploadImage,
  uploadToProvider,
} from "../src/upload.js";
import { createStorage, DEFAULT_IMGUR_CLIENT_ID } from "../src/storage.js";
import { dom, memoryAPI } from "./helpers.js";

test("upload completion preserves concurrent typing and removed markers", () => {
  dom("<textarea></textarea>");
  const textarea = document.querySelector("textarea");
  textarea.value = "before [upload] after plus new typing";
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  assert.equal(replacePlaceholder(textarea, "[upload]", "https://i.imgur.com/a.png"), true);
  assert.equal(textarea.value, "before https://i.imgur.com/a.png after plus new typing");
  assert.equal(textarea.selectionStart, textarea.value.length);
  const before = textarea.value;
  assert.equal(replacePlaceholder(textarea, "[gone]", "link"), false);
  assert.equal(textarea.value, before);
});

test("upload validates files and response URLs before changing the draft", async () => {
  dom("");
  const image = new File(["image"], "test.png", { type: "image/png" });
  const result = await uploadImage(image, (request) => {
    assert.equal(request.url, "https://api.imgur.com/3/image");
    assert.equal(request.anonymous, true);
    assert.equal(request.headers.Authorization, `Client-ID ${DEFAULT_IMGUR_CLIENT_ID}`);
    request.onload({
      status: 200,
      responseText:
        '{"success":true,"data":{"link":"https://i.imgur.com/a.png","deletehash":"abc123"}}',
    });
  });
  assert.equal(result.link, "https://i.imgur.com/a.png");
  await assert.rejects(
    uploadImage(new File(["x"], "x.svg", { type: "image/svg+xml" }), () => assert.fail()),
    /PNG/,
  );
  await assert.rejects(
    uploadImage(image, (request) =>
      request.onload({
        status: 200,
        responseText: '{"success":true,"data":{"link":"https://evil.test/a.png"}}',
      }),
    ),
    /上传失败/,
  );
  await assert.rejects(
    uploadImage(image, (request) => request.ontimeout()),
    /上传超时/,
  );
});

test("Catbox sends anonymous file uploads and accepts only its file host", async () => {
  dom("");
  const file = new File(["image"], "image.png", { type: "image/png" });
  const options = { uploadProvider: "catbox" };
  const result = await uploadToProvider(file, options, (request) => {
    assert.equal(request.url, "https://catbox.moe/user/api.php");
    assert.equal(request.anonymous, true);
    assert.equal(request.data.get("reqtype"), "fileupload");
    assert.equal(request.data.get("fileToUpload").name, "image.png");
    assert.equal(request.data.get("userhash"), null);
    request.onload({ status: 200, responseText: "https://files.catbox.moe/abc123.png" });
  });
  assert.deepEqual(result, { provider: "catbox", link: "https://files.catbox.moe/abc123.png" });
  await assert.rejects(
    uploadToProvider(file, options, (request) =>
      request.onload({ status: 200, responseText: "https://evil.test/abc123.png" }),
    ),
  );
});

test("upload entry sits beside Reply with the same button styling as editor controls", () => {
  dom(
    '<div id="reply-box"><div class="cell"><div>New Comment</div><div>Back to top</div></div><div class="cell"><form><textarea id="reply_content"></textarea><button type="submit">Reply</button></form></div></div>',
  );
  initUpload({ upload: true }, createStorage(memoryAPI()), () => assert.fail());
  const submit = document.querySelector('button[type="submit"]');
  const pick = document.querySelector(".vx-upload-button");
  assert.equal(submit.parentElement.className, "vx-reply-actions");
  assert.equal(submit.nextElementSibling, pick);
  assert.equal(pick.tagName, "BUTTON");
  assert.equal(pick.type, "button");
  assert.equal(pick.textContent, "图片");
  assert.equal(pick.classList.contains("vx-editor-action-button"), true);
  assert.equal(pick.querySelector("svg"), null);
  assert.equal(pick.getAttribute("aria-label"), "插入图片");
  assert.equal(pick.classList.contains("normal"), true);
  assert.equal(pick.classList.contains("button"), true);
  assert.equal(document.querySelector(".vx-upload .vr_upload_image"), null);
});

test("topic image entry sits beside the non-submit publication control", () => {
  dom(`<form><textarea name="content"></textarea><div class="topic-actions">
    <input type="button" class="super normal button publish-theme" value="发布主题">
  </div></form>`);
  initUpload({ upload: true }, createStorage(memoryAPI()), () => assert.fail());
  const publish = document.querySelector('input[value="发布主题"]');
  const pick = document.querySelector(".vx-upload-button");
  assert.equal(publish.parentElement.className, "vx-reply-actions");
  assert.equal(publish.nextElementSibling, pick);
  assert.equal(pick.classList.contains("publish-theme"), true);
  assert.equal(pick.textContent, "图片");
});

test("topic image entry moves beside an asynchronously rendered publication control", async () => {
  dom(
    '<div id="Main"><form><textarea name="content"></textarea></form><div id="footer"></div></div>',
  );
  initUpload({ upload: true }, createStorage(memoryAPI()), () => assert.fail());
  const pick = document.querySelector(".vx-upload-button");
  assert.equal(pick.parentElement.tagName, "FORM");
  document
    .querySelector("#footer")
    .insertAdjacentHTML(
      "beforeend",
      '<button type="button" class="normal button">发布主题</button>',
    );
  await new Promise(setImmediate);
  const publish = document.querySelector("#footer button");
  assert.equal(publish.parentElement.className, "vx-reply-actions");
  assert.equal(pick.parentElement, publish.parentElement);
  assert.equal(publish.nextElementSibling, pick);
});

test("rate limiting stops the queue and persists the pause without rotating IDs", async () => {
  dom(
    '<form><textarea id="reply_content">Existing draft</textarea><button type="submit">Reply</button></form>',
  );
  const store = createStorage(memoryAPI());
  let calls = 0;
  initUpload({ upload: true }, store, (request) => {
    calls++;
    request.onload({
      status: 429,
      responseHeaders: "Retry-After: 60",
      responseText: "Too many uploads",
    });
  });
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", {
    value: [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.png", { type: "image/png" }),
    ],
  });
  input.dispatchEvent(new Event("change"));
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  assert.ok(store.get("upload-paused-until") > Date.now());
  assert.doesNotMatch(document.querySelector("textarea").value, /vx-upload/);
  assert.match(document.querySelector("textarea").value, /Existing draft/);
  assert.equal(store.uploads().length, 0);
});

test("the upload queue uses the selected host even while another host is paused", async () => {
  const { window } = dom('<form><textarea id="reply_content"></textarea></form>');
  const store = createStorage(memoryAPI());
  store.set("upload-paused-until", Date.now() + 60_000);
  initUpload({ upload: true, uploadProvider: "catbox" }, store, (request) => {
    assert.equal(request.url, "https://catbox.moe/user/api.php");
    request.onload({ status: 200, responseText: "https://files.catbox.moe/uploaded.png" });
  });
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", {
    value: [new File(["image"], "uploaded.png", { type: "image/png" })],
  });
  input.dispatchEvent(new Event("change"));
  await new Promise(setImmediate);
  assert.equal(
    document.querySelector("textarea").value.trim(),
    "https://files.catbox.moe/uploaded.png",
  );
  assert.equal(store.uploads()[0].provider, "catbox");
  window.close();
});

test("upload records survive another storage instance and stay out of tag backups", () => {
  const api = memoryAPI(),
    first = createStorage(api),
    second = createStorage(api);
  first.recordUpload({ link: "https://i.imgur.com/a.png", deleteHash: "abc", fileName: "a.png" });
  second.recordUpload({ link: "https://i.imgur.com/b.png", deleteHash: "def", fileName: "b.png" });
  assert.equal(createStorage(api).uploads().length, 2);
  assert.doesNotMatch(first.export(), /deleteHash|i.imgur.com/);
});

test("rejected image drops cancel browser navigation and preserve the draft", () => {
  for (const paused of [true, false]) {
    const { window } = dom('<form><textarea id="reply_content">Unsaved draft</textarea></form>');
    const store = createStorage(memoryAPI());
    if (paused) store.set("upload-paused-until", Date.now() + 60_000);
    initUpload({ upload: true }, store, () => assert.fail("unexpected upload"));
    const textarea = document.querySelector("textarea");
    const drop = (files) => {
      const event = new window.Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: { files } });
      textarea.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const image = new File(["image"], "test.png", { type: "image/png" });
    assert.equal(drop(Array(paused ? 1 : 11).fill(image)), true);
    assert.equal(textarea.value, "Unsaved draft");
    assert.equal(store.uploads().length, 0);
    assert.equal(drop([new File(["text"], "test.txt", { type: "text/plain" })]), false);
    assert.equal(drop([]), false);
    const submit = new window.Event("submit", { bubbles: true, cancelable: true });
    textarea.form.dispatchEvent(submit);
    assert.equal(submit.defaultPrevented, false);
    window.close();
  }
});

test("upload history links lazy Imgur previews and preserves original and deletion links", () => {
  dom("");
  document.body.append(
    createUploadHistory({
      uploads: () => [
        {
          link: "https://i.imgur.com/example.png",
          deleteHash: "remove123",
          fileName: "example.png",
          sourceTopic: { title: "Example topic", url: "https://v2ex.com/t/123?p=2#r_1" },
        },
        {
          link: "https://other.test/example.png",
          fileName: "other.png",
          sourceTopic: { title: "External link", url: "https://v2ex.com.other.test/t/123" },
        },
      ],
    }),
  );
  const images = document.querySelectorAll(".vx-upload-record img");
  assert.equal(images.length, 1);
  const [image] = images;
  assert.equal(image.getAttribute("src"), "https://i.imgur.com/examplem.png");
  assert.equal(image.getAttribute("loading"), "lazy");
  assert.equal(image.getAttribute("referrerpolicy"), "no-referrer");
  assert.equal(image.parentElement.href, "https://i.imgur.com/example.png");
  assert.equal(image.parentElement.target, "_blank");
  image.dispatchEvent(new Event("error"));
  assert.equal(image.src, "https://i.imgur.com/example.png");
  image.dispatchEvent(new Event("error"));
  assert.equal(image.isConnected, false);
  assert.ok(document.querySelector('a[href="https://i.imgur.com/example.png"]'));
  assert.ok(document.querySelector('a[href="https://imgur.com/delete/remove123"]'));
  assert.equal(
    document.querySelector('a[href="https://v2ex.com/t/123"]').textContent,
    "Example topic",
  );
  assert.equal(document.querySelector('a[href*="other.test"]'), null);
});

test("upload history previews ImgBB and Catbox and validates ImgBB deletion links", () => {
  dom("");
  document.body.append(
    createUploadHistory({
      uploads: () => [
        {
          link: "https://i.ibb.co/abc/a.png",
          deleteURL: "https://ibb.co/abc/delete/token",
          fileName: "a.png",
        },
        {
          link: "https://files.catbox.moe/b.png",
          deleteURL: "https://evil.test/delete",
          fileName: "b.png",
        },
      ],
    }),
  );
  const images = [...document.querySelectorAll(".vx-upload-record-preview img")];
  assert.deepEqual(
    images.map((image) => image.src),
    ["https://i.ibb.co/abc/a.png", "https://files.catbox.moe/b.png"],
  );
  assert.ok(document.querySelector('a[href="https://ibb.co/abc/delete/token"]'));
  assert.equal(document.querySelector('a[href="https://evil.test/delete"]'), null);
  assert.match(document.querySelector(".vx-upload-record").textContent, /ImgBB/);
});

test("uploads record the source topic with the image in one write", async () => {
  for (const [path, expected] of [
    ["/t/123?p=2#r_99", { url: "https://www.v2ex.com/t/123", title: "Topic title" }],
    ["/new", undefined],
  ]) {
    const { window } = dom(
      '<div id="Main"><div class="header"><h1>Topic title</h1></div><form><textarea name="content"></textarea></form></div>',
      `https://www.v2ex.com${path}`,
    );
    const api = memoryAPI();
    const store = createStorage(api);
    initUpload({ upload: true }, store, (request) =>
      request.onload({
        status: 200,
        responseText: '{"success":true,"data":{"link":"https://i.imgur.com/a.png"}}',
      }),
    );
    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", {
      value: [new File(["a"], "a.png", { type: "image/png" })],
    });
    input.dispatchEvent(new Event("change"));
    await new Promise(setImmediate);
    assert.equal(api.writes.length, 1);
    assert.deepEqual(store.uploads()[0].sourceTopic, expected);
    assert.equal(document.querySelector("textarea").value.trim(), "https://i.imgur.com/a.png");
    window.close();
  }
});

test("history removes confirmed Imgur deletions and lets users remove local records", async () => {
  const { window } = dom("");
  const store = createStorage(memoryAPI());
  store.recordUpload({ link: "https://i.imgur.com/deleted.png", fileName: "deleted.png" });
  store.recordUpload({ link: "https://i.imgur.com/unknown.png", fileName: "unknown.png" });
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, method: options.method });
    return url.endsWith("/deleted.png")
      ? { redirected: true, url: "https://i.imgur.com/removed.png" }
      : { status: 404, redirected: false, url };
  };
  try {
    document.body.append(createUploadHistory(store));
    for (const preview of document.querySelectorAll(".vx-upload-record-preview img"))
      preview.dispatchEvent(new Event("load"));
    await new Promise(setImmediate);
    assert.deepEqual(
      store.uploads().map((record) => record.fileName),
      ["unknown.png"],
    );
    assert.equal(requests.length, 2);
    assert.ok(requests.every(({ method }) => method === "HEAD"));
    assert.match(document.querySelector(".vx-upload-history-status").textContent, /在 Imgur 删除/);
    const remove = document.querySelector(".vx-upload-remove");
    window.confirm = () => false;
    remove.click();
    assert.equal(store.uploads().length, 1);
    window.confirm = () => true;
    remove.click();
    assert.deepEqual(store.uploads(), []);
    assert.equal(requests.length, 2);
    assert.equal(document.querySelector(".vx-upload-record"), null);
    assert.match(document.querySelector(".vx-upload-history-list").textContent, /暂无上传记录/);
  } finally {
    globalThis.fetch = previousFetch;
    window.close();
  }
});

test("upload history limits concurrent HEAD verification probes", async () => {
  const { window } = dom("");
  const store = createStorage(memoryAPI());
  for (let i = 0; i < 10; i++)
    store.recordUpload({ link: `https://i.imgur.com/img${i}.png`, fileName: `img${i}.png` });
  const previousFetch = globalThis.fetch;
  let active = 0;
  let peak = 0;
  let total = 0;
  globalThis.fetch = async (url) => {
    active++;
    total++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return { status: 200, redirected: false, url };
  };
  try {
    document.body.append(createUploadHistory(store));
    for (const preview of document.querySelectorAll(".vx-upload-record-preview img"))
      preview.dispatchEvent(new Event("load"));
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(total, 10);
    assert.ok(peak <= 4, `Expected peak <= 4, got ${peak}`);
  } finally {
    globalThis.fetch = previousFetch;
    window.close();
  }
});

test("topic upload inserts and replaces markers inside CodeMirror and guards publish click", async () => {
  const { window } = dom(
    `<form action="/write">
      <textarea id="topic_content" name="content" style="display:none"></textarea>
      <div class="CodeMirror"></div>
      <button type="button" class="super normal button">发布主题</button>
    </form>`,
    "https://www.v2ex.com/write",
  );
  const textarea = document.querySelector("#topic_content");
  const cmNode = document.querySelector(".CodeMirror");
  let value = "Topic ";
  let cursor = value.length;
  cmNode.CodeMirror = {
    getValue: () => value,
    setValue(next) {
      value = next;
    },
    replaceSelection(text) {
      value = value.slice(0, cursor) + text + value.slice(cursor);
      cursor += text.length;
    },
    posFromIndex: (index) => ({ index }),
    replaceRange(replacement, from, to) {
      value = value.slice(0, from.index) + replacement + value.slice(to.index);
    },
    save() {
      textarea.value = value;
    },
    focus() {},
  };

  let finishRequest;
  initUpload({ upload: true }, createStorage(memoryAPI()), (request) => {
    finishRequest = () =>
      request.onload({
        status: 200,
        responseText: '{"success":true,"data":{"link":"https://i.imgur.com/topic.png"}}',
      });
  });

  const paste = new window.Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", {
    value: {
      items: [{ kind: "file", getAsFile: () => new File(["a"], "a.png", { type: "image/png" }) }],
    },
  });
  cmNode.dispatchEvent(paste);
  assert.equal(paste.defaultPrevented, true);
  assert.match(value, /^Topic \n\[vx-upload:[^\]]+\]\n$/);
  assert.equal(textarea.value, value);

  const publish = document.querySelector("button");
  let published = 0;
  publish.addEventListener("click", () => published++);
  publish.click();
  assert.equal(published, 0);

  await new Promise(setImmediate);
  finishRequest();
  await new Promise(setImmediate);
  assert.equal(value, "Topic \nhttps://i.imgur.com/topic.png\n");
  assert.equal(textarea.value, "Topic \nhttps://i.imgur.com/topic.png\n");

  publish.click();
  assert.equal(published, 1);
  window.close();
});
