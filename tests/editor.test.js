import assert from "node:assert/strict";
import test from "node:test";
import { createEditor, resolveCodeMirror } from "../src/editor.js";
import { dom } from "./helpers.js";

function mockCodeMirror(textarea, initial = "", { standalone = false } = {}) {
  let text = initial;
  let focused = 0;
  let saved = 0;
  let cursor = text.length;
  const cm = {
    getValue: () => text,
    setValue(next) {
      text = String(next);
    },
    replaceSelection(insert) {
      text = text.slice(0, cursor) + insert + text.slice(cursor);
      cursor += insert.length;
    },
    posFromIndex: (index) => ({ index }),
    replaceRange(replacement, from, to) {
      const beforeLen = text.length;
      text = text.slice(0, from.index) + replacement + text.slice(to.index);
      if (cursor >= to.index) cursor += text.length - beforeLen;
    },
    focus() {
      focused++;
    },
    ...(standalone
      ? {}
      : {
          save() {
            saved++;
            textarea.value = text;
          },
        }),
  };
  return {
    cm,
    stats: () => ({ focused, saved, cursor, text }),
  };
}

test("createEditor detects CodeMirror in pageWindow when isolated from content-script DOM", () => {
  const { window } = dom(
    '<form action="/write"><textarea id="topic_content" name="content"></textarea><div class="CodeMirror"></div></form>',
  );
  const textarea = document.querySelector("textarea");
  const cmWrapper = document.querySelector(".CodeMirror");
  const { cm, stats } = mockCodeMirror(textarea, "Hello ");

  // Simulate Chrome Tampermonkey isolated world where cmWrapper.CodeMirror is hidden on the wrapper,
  // while unsafeWindow.document exposes the real CodeMirror instance.
  const pageCmElement = { CodeMirror: cm };
  const pageWindow = {
    document: {
      querySelectorAll: (selector) => (selector === ".CodeMirror" ? [pageCmElement] : []),
    },
  };
  assert.equal(cmWrapper.CodeMirror, undefined);
  assert.equal(resolveCodeMirror(textarea, pageWindow).cm, cm);

  const editor = createEditor(textarea, pageWindow);
  editor.insert("[doge]");
  assert.equal(editor.getValue(), "Hello [doge]");
  assert.equal(textarea.value, "Hello [doge]");
  assert.equal(stats().focused, 1);
  assert.equal(stats().saved, 1);

  assert.equal(editor.replaceMarker("[doge]", "https://img.test/a.png"), true);
  assert.equal(editor.getValue(), "Hello https://img.test/a.png");
  assert.equal(textarea.value, "Hello https://img.test/a.png");
  window.close();
});

test("createEditor syncs standalone CodeMirror instances that omit save()", () => {
  const { window } = dom(
    '<form action="/write"><div id="editor"><div class="CodeMirror"></div></div><textarea id="topic_content" name="content"></textarea></form>',
  );
  const textarea = document.querySelector("#topic_content");
  const cmWrapper = document.querySelector(".CodeMirror");
  const { cm } = mockCodeMirror(textarea, "Draft ", { standalone: true });
  cmWrapper.CodeMirror = cm;

  let inputs = 0;
  textarea.addEventListener("input", () => inputs++);

  const editor = createEditor(textarea, {});
  editor.insert("[ok]");
  assert.equal(cm.getValue(), "Draft [ok]");
  assert.equal(textarea.value, "Draft [ok]");
  assert.equal(inputs, 1);

  editor.setValue("Draft https://example.com/ok.png");
  assert.equal(cm.getValue(), "Draft https://example.com/ok.png");
  assert.equal(textarea.value, "Draft https://example.com/ok.png");
  assert.equal(inputs, 2);
  window.close();
});

test("createEditor binds editor surface listeners once CodeMirror mounts asynchronously", async () => {
  const { window } = dom('<form action="/write"><textarea name="content"></textarea></form>');
  const form = document.querySelector("form");
  const textarea = document.querySelector("textarea");
  const editor = createEditor(textarea, {});
  const attached = [];
  editor.onEditorSurface((target, capture) =>
    attached.push([target.className || target.tagName, capture]),
  );
  assert.deepEqual(attached, [["TEXTAREA", false]]);

  const cm = document.createElement("div");
  cm.className = "CodeMirror";
  form.append(cm);
  await new Promise(setImmediate);
  assert.deepEqual(attached, [
    ["TEXTAREA", false],
    ["CodeMirror", true],
  ]);
  window.close();
});
