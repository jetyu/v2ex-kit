import assert from "node:assert/strict";
import test from "node:test";
import {
  createStorage,
  normalizeFilterKeywords,
  normalizeOptions,
  normalizeTags,
  parseImport,
} from "../src/storage.js";
import { memoryAPI } from "./helpers.js";

test("options reject invalid types and unknown fields", () => {
  const options = normalizeOptions({
    language: ["ja"],
    theme: "broken",
    privacy: true,
    preloadPages: 99,
    imgurClientId: "x\r\ny",
    injected: true,
  });
  assert.equal(options.theme, "native");
  assert.equal(normalizeOptions({}).theme, "native");
  for (const theme of ["arco-clear", "minimalist", "warm-sand", "mist-violet"])
    assert.equal(normalizeOptions({ theme }).theme, "native");
  assert.equal(normalizeOptions({ theme: "vscode" }).theme, "vscode");
  assert.equal(normalizeOptions({ theme: "native" }).theme, "native");
  assert.equal(normalizeOptions({ theme: ["vscode"] }).theme, "native");
  assert.equal(options.language, undefined);
  assert.equal(normalizeOptions({ language: "site" }).language, undefined);
  assert.equal(Object.hasOwn(options, "privacy"), false);
  assert.equal(options.preloadPages, 0);
  for (const key of ["hotReplies", "autoCheckIn", "tags", "upload", "contentFilter"])
    assert.equal(options[key], false, key);
  assert.equal(options.base64Decode, true);
  assert.equal(normalizeOptions({ base64Decode: false }).base64Decode, false);
  assert.equal(options.imgurClientId, "");
  assert.equal(options.injected, undefined);
  assert.equal(options.replyPreview, true);
  assert.deepEqual(options.filterKeywords, []);
  assert.equal(normalizeOptions({ filterMode: "invalid" }).filterMode, "collapse");
  assert.equal(normalizeOptions({ filterMode: "blur" }).filterMode, "collapse");
});

test("filter keywords are trimmed, deduplicated, bounded, and safely normalized", () => {
  assert.deepEqual(normalizeFilterKeywords(" Spam \nspam\nＡＤ\n\nword "), [
    "Spam",
    "ＡＤ",
    "word",
  ]);
  assert.deepEqual(normalizeFilterKeywords(["ok", null, 7, "also ok"]), ["ok", "also ok"]);
  assert.equal(normalizeFilterKeywords(["x".repeat(150)])[0].length, 100);
  assert.equal(
    normalizeFilterKeywords(Array.from({ length: 250 }, (_, i) => `word-${i}`)).length,
    200,
  );
});

test("Polish import accepts old tag objects and validates the entire file", () => {
  assert.deepEqual(normalizeTags([" a ", { name: "b" }, "a"]), ["a", "b"]);
  assert.deepEqual(
    parseImport('V2EX_Polish_settings{"member-tag":{"Alice":{"tags":[{"name":"backend"}]}}}')
      .members.alice,
    ["backend"],
  );
  assert.throws(
    () => parseImport('{"member-tag":{"ok":{"tags":["valid"]},"bad/user":[]}}'),
    /\u7528\u6237\u540d/,
  );
  assert.throws(() => parseImport('{"schema":2,"members":{}}'), /\u7248\u672c/);
  assert.throws(() => parseImport('{"members":{"alice":{"tags":[null]}}}'), /\u6807\u7b7e/);
});

test("storage writes only changes; local entries and tombstones win imports", () => {
  const api = memoryAPI();
  const store = createStorage(api);
  store.setTags("Alice", ["local"]);
  store.setTags("alice", ["local"]);
  store.setTags("Bob", []);
  assert.equal(api.writes.length, 2);
  assert.equal(
    store.import('{"members":{"alice":["remote"],"bob":["remote"],"carol":["new"]}}'),
    1,
  );
  assert.deepEqual(store.getTags("ALICE"), ["local"]);
  assert.deepEqual(store.getTags("Bob"), []);
  const before = api.writes.length;
  assert.throws(() => store.import('{"members":{"fresh":["a"],"bad/name":[]}}'));
  assert.equal(api.writes.length, before);
});

test("backup excludes Client ID and runtime state; remote events never echo writes", () => {
  const api = memoryAPI();
  const store = createStorage(api);
  store.saveOptions({ imgurClientId: "abc123", theme: "vscode" });
  store.set("daily:reader", { success: true });
  store.watchTags("Alice", () => {});
  const before = api.writes.length;
  api.listeners.get("v2ex-lite:member:alice")("key", [], ["remote"], true);
  assert.deepEqual(store.getTags("Alice"), ["remote"]);
  assert.equal(api.writes.length, before);
  const backup = JSON.parse(store.export());
  assert.equal(backup.options.imgurClientId, undefined);
  assert.equal(backup.options.theme, "vscode");
  assert.equal(JSON.stringify(backup).includes("daily:"), false);
});
