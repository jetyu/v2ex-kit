import assert from "node:assert/strict";
import test from "node:test";
import { openSettings } from "../src/settings.js";
import { setLanguage } from "../src/i18n.js";
import { createStorage } from "../src/storage.js";
import { dom, memoryAPI } from "./helpers.js";

test("closing upload history returns to settings and preserves unsaved fields", () => {
  const { window } = dom("");
  const api = memoryAPI();
  openSettings(createStorage(api), true);
  const settings = document.querySelector("#vx-settings-dialog");
  const language = settings.querySelector('[name="language"]');
  language.value = "ja";
  settings.querySelector('[name="theme"]').value = "vscode";
  settings.querySelector("#vx-settings-tab-images").click();
  const history = settings.querySelector("#vx-settings-panel-images > button");
  for (const method of ["button", "escape", "backdrop"]) {
    history.focus();
    history.click();
    const child = [...document.querySelectorAll(".v2p-modal-mask")].at(-1);
    assert.notEqual(child, settings);
    assert.equal(settings.hasAttribute("inert"), true);
    if (method === "button") child.querySelector(".v2p-modal-close-btn").click();
    else if (method === "escape")
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    else {
      child.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
      child.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true }));
    }
    assert.equal(document.querySelectorAll(".v2p-modal-mask").length, 1);
    assert.equal(settings.isConnected, true);
    assert.equal(settings.hasAttribute("inert"), false);
    assert.equal(language.value, "ja");
    assert.equal(settings.querySelector('[name="theme"]').value, "vscode");
    assert.equal(document.activeElement, history);
    assert.equal(document.body.classList.contains("v2p-modal-open"), true);
  }
  assert.deepEqual(api.writes, []);
  settings.querySelector(".v2p-modal-close-btn").click();
  assert.equal(document.querySelector(".v2p-modal-mask"), null);
  assert.equal(document.body.classList.contains("v2p-modal-open"), false);
  window.close();
});

test("settings give every option a Chinese label and an associated description", () => {
  dom("");
  const store = createStorage(memoryAPI());
  store.saveOptions({
    preloadPages: 3,
    imgurClientId: "custom123",
    privacy: true,
    theme: "vscode",
  });
  openSettings(store);
  const controls = [...document.querySelectorAll("form :is(input,select)[name]")];
  assert.equal(controls.length, 16);
  assert.equal(document.querySelectorAll('[role="tabpanel"]').length, 6);
  assert.equal(
    document.querySelector(".v2p-modal-footer [type=submit]").form.id,
    "vx-settings-form",
  );
  for (const control of controls) {
    assert.match(control.closest("label").textContent, /[\u4e00-\u9fff]/);
    const help = document.getElementById(control.getAttribute("aria-describedby"));
    assert.match(help.textContent, /[\u4e00-\u9fff]/);
  }
  assert.equal(document.querySelector('[name="privacy"]'), null);
  assert.equal(document.querySelector('[name="imgurProxy"]').checked, false);
  assert.equal(
    document.querySelector('[name="imgurProxyUrl"]').value,
    "https://proxy.duckduckgo.com/iu/?u=",
  );
  const preload = document.querySelector('select[name="preloadPages"]');
  assert.equal(preload.value, "3");
  assert.deepEqual(
    [...preload.options].map(({ value, text }) => [value, text]),
    ["关闭", "1", "2", "3", "4", "5"].map((label, count) => [String(count), label]),
  );
  assert.equal(document.querySelector('[name="imgurClientId"]').value, "custom123");
  const theme = document.querySelector('[name="theme"]');
  assert.equal(theme.value, "vscode");
  assert.deepEqual(
    [...theme.options].map((option) => option.value),
    ["plus-emerald", "geist", "claude", "vscode", "native"],
  );
  const language = document.querySelector('[name="language"]');
  assert.equal(language.value, "zh");
  assert.deepEqual(
    [...language.options].map((option) => option.value),
    ["zh", "en", "ja", "site"],
  );
  assert.match(document.querySelector(".vx-storage-help").textContent, /本地/);
  assert.equal(document.querySelectorAll('[name*="font"]').length, 0);
  document.querySelector(".v2p-modal-close-btn").click();
});

test("guest settings retain saved preferences and show account dependencies", () => {
  dom('<html lang="zh-CN">');
  setLanguage("en");
  const original = createStorage(memoryAPI()).options();
  let saved;
  openSettings(
    {
      ...createStorage(memoryAPI()),
      options: () => original,
      saveOptions(next) {
        saved = next;
        throw new Error("Stop before the browser reload");
      },
    },
    false,
  );
  assert.match(document.querySelector(".v2p-modal-title").textContent, /Settings/);
  assert.match(document.querySelector(".vx-settings-notice").textContent, /Sign in/);
  for (const key of ["autoCheckIn", "emoji", "upload", "imgurClientId"]) {
    const control = document.querySelector(`[name="${key}"]`);
    assert.equal(control.disabled, true);
    assert.equal(control.checked, false);
    assert.match(
      control.closest("label").querySelector("small").textContent,
      /Requires V2EX sign-in/,
    );
  }
  document.querySelector('[name="preloadPages"]').value = "1";
  document.querySelector('[name="language"]').value = "ja";
  assert.equal(document.querySelector('[name="theme"]').disabled, false);
  document.querySelector('[name="theme"]').value = "vscode";
  document
    .querySelector("form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  assert.deepEqual(saved, { ...original, preloadPages: 1, language: "ja", theme: "vscode" });
  document.querySelector(".v2p-modal-close-btn").click();
  setLanguage("zh");
});

test("invalid preload values cannot overwrite saved settings", () => {
  dom("");
  const api = memoryAPI(),
    store = createStorage(api);
  openSettings(store);
  document.querySelector('[name="preloadPages"]').value = "99";
  document
    .querySelector("form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(api.writes.length, 0);
  assert.equal(
    document.querySelector("#vx-settings-tab-display").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(document.activeElement.name, "preloadPages");
  document.querySelector(".v2p-modal-close-btn").click();
});

test("Apply saves across tabs and keeps the settings panel open", () => {
  const { window } = dom("");
  const store = createStorage(memoryAPI());
  store.saveOptions({ hotReplies: false, hotRepliesLimit: 4 });
  openSettings(store);
  const dialog = document.querySelector("#vx-settings-dialog");
  dialog.querySelector('[name="language"]').value = "ja";
  const display = dialog.querySelector("#vx-settings-tab-display");
  display.click();
  dialog.querySelector('[name="theme"]').value = "native";
  const hotLimit = dialog.querySelector('select[name="hotReplies"]');
  assert.equal(hotLimit.value, "0");
  assert.deepEqual(
    [...hotLimit.options].map((option) => option.value),
    ["0", "1", "2", "3", "4", "5"],
  );
  assert.equal(hotLimit.options[0].textContent, "关闭");
  hotLimit.value = "2";
  dialog.querySelector('[name="base64Decode"]').checked = false;
  dialog.querySelector('.v2p-modal-footer button[type="button"]').click();
  assert.equal(store.options().language, "ja");
  assert.equal(store.options().theme, "native");
  assert.equal(store.options().hotRepliesLimit, 2);
  assert.equal(store.options().hotReplies, true);
  hotLimit.value = "0";
  dialog.querySelector('.v2p-modal-footer button[type="button"]').click();
  assert.equal(store.options().hotReplies, false);
  assert.equal(store.options().hotRepliesLimit, 2);
  assert.equal(store.options().base64Decode, false);
  assert.equal(dialog.isConnected, true);
  assert.equal(display.getAttribute("aria-selected"), "true");
  assert.match(dialog.querySelector('.v2p-modal-footer [role="status"]').textContent, /已保存/);
  window.close();
});

test("settings tabs support keyboard navigation and retain edits across pages", () => {
  const { window } = dom("");
  openSettings(createStorage(memoryAPI()));
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];
  assert.deepEqual(
    panels.map((panel) => panel.hidden),
    [false, true, true, true, true, true],
  );
  assert.deepEqual(
    panels.map((panel) => [...panel.querySelectorAll("[name]")].map((field) => field.name)),
    [
      ["language", "newTab", "autoCheckIn"],
      [
        "theme",
        "preview",
        "userCards",
        "autoFold",
        "base64Decode",
        "hotReplies",
        "preloadPages",
        "emoji",
      ],
      ["imgurProxy", "imgurProxyUrl", "upload", "imgurClientId"],
      ["tags"],
      [],
      [],
    ],
  );
  const language = panels[0].querySelector('[name="language"]');
  language.value = "ja";
  tabs[0].focus();
  tabs[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  assert.equal(document.activeElement, tabs[5]);
  assert.equal(tabs[5].textContent, "关于");
  assert.ok(panels[4].querySelector(".vx-backup"));
  assert.deepEqual(
    [...panels[5].querySelectorAll("a")].map((link) => link.href),
    [
      "https://github.com/jetyu/v2ex-kit",
      "https://github.com/jetyu/v2ex-kit/issues",
      "https://github.com/jetyu/v2ex-kit/blob/main/LICENSE",
      "https://github.com/coolpace/V2EX_Polish",
      "https://github.com/v2hot/v2ex.rep",
      "https://github.com/thinktip/v2ex-plus",
      "https://github.com/yuyinws/v2ex-theme",
    ],
  );
  assert.deepEqual(
    panels.map((panel) => panel.hidden),
    [true, true, true, true, true, false],
  );
  tabs[0].click();
  assert.equal(language.value, "ja");
  document.querySelector(".v2p-modal-close-btn").click();
  window.close();
});
