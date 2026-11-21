import assert from "node:assert/strict";
import test from "node:test";
import { openSettings } from "../src/settings.js";
import { createStorage } from "../src/storage.js";
import { dom, memoryAPI } from "./helpers.js";

test("upload history renders lazily inside the image settings tab", () => {
  const { window } = dom("");
  const api = memoryAPI();
  openSettings(createStorage(api), true);
  const settings = document.querySelector("#vx-settings-dialog");
  settings.querySelector('[name="theme"]').value = "vscode";
  const tab = settings.querySelector("#vx-settings-tab-images");
  assert.equal(settings.querySelector(".vx-upload-history-list"), null);
  tab.click();
  const history = settings.querySelector(".vx-upload-history-list");
  assert.ok(history);
  assert.match(history.textContent, /暂无上传记录/);
  assert.equal(document.querySelectorAll(".v2p-modal-mask").length, 1);
  assert.equal(settings.querySelector('[name="theme"]').value, "vscode");
  settings.querySelector("#vx-settings-tab-general").click();
  tab.click();
  assert.equal(settings.querySelector(".vx-upload-history-list"), history);
  assert.deepEqual(api.writes, []);
  settings.querySelector(".v2p-modal-close-btn").click();
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
  const controls = [...document.querySelectorAll("form :is(input,select,textarea)[name]")];
  assert.equal(controls.length, 20);
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
  assert.equal(document.querySelector('[name="imgurProxyUrl"]'), null);
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
  assert.equal(document.querySelector('[name="language"]'), null);
  const filterMode = document.querySelector('[name="filterMode"]');
  assert.equal(filterMode.value, "collapse");
  assert.deepEqual(
    [...filterMode.options].map(({ value, textContent }) => [value, textContent]),
    [
      ["collapse", "折叠"],
      ["hide", "隐藏"],
    ],
  );
  assert.equal(document.querySelector('[name="filterKeywords"]').tagName, "TEXTAREA");
  assert.match(document.querySelector(".vx-storage-help").textContent, /本地/);
  assert.equal(document.querySelectorAll('[name*="font"]').length, 0);
  assert.equal(document.querySelector('[name="imgurProxy"]').closest("fieldset"), null);
  assert.equal(document.querySelector("#vx-settings-form fieldset"), null);
  document.querySelector(".v2p-modal-close-btn").click();
});

test("content filter controls retain their values while the master switch is off", () => {
  const { window } = dom("");
  const store = createStorage(memoryAPI());
  openSettings(store, true);
  const master = document.querySelector('[name="contentFilter"]');
  const dependencies = ["filterTopics", "filterReplies", "filterMode", "filterKeywords"].map(
    (name) => document.querySelector(`[name="${name}"]`),
  );
  assert.equal(master.checked, false);
  assert.ok(dependencies.every((control) => control.disabled));
  assert.ok(
    dependencies.every((control) =>
      control.closest(".vx-settings-option").classList.contains("vx-settings-option-disabled"),
    ),
  );
  assert.equal(dependencies[0].checked, true);
  assert.equal(dependencies[1].checked, true);

  master.checked = true;
  master.dispatchEvent(new Event("change", { bubbles: true }));
  assert.ok(dependencies.every((control) => !control.disabled));
  dependencies[0].checked = false;
  dependencies[2].value = "hide";
  dependencies[3].value = "spam\n广告";
  master.checked = false;
  master.dispatchEvent(new Event("change", { bubbles: true }));
  assert.ok(dependencies.every((control) => control.disabled));
  assert.equal(dependencies[0].checked, false);
  assert.equal(dependencies[2].value, "hide");
  assert.equal(dependencies[3].value, "spam\n广告");

  document.querySelector('.v2p-modal-footer button[type="button"]').click();
  assert.equal(store.options().contentFilter, false);
  assert.equal(store.options().filterTopics, false);
  assert.equal(store.options().filterMode, "hide");
  assert.deepEqual(store.options().filterKeywords, ["spam", "广告"]);
  window.close();
});

test("Imgur Client ID follows the image upload switch without losing its value", () => {
  const { window } = dom("");
  const store = createStorage(memoryAPI());
  store.saveOptions({ upload: false, imgurClientId: "custom123" });
  openSettings(store, true);
  const upload = document.querySelector('[name="upload"]');
  const clientId = document.querySelector('[name="imgurClientId"]');
  const wrapper = clientId.closest(".vx-settings-option");
  assert.equal(upload.checked, false);
  assert.equal(clientId.disabled, true);
  assert.equal(clientId.value, "custom123");
  assert.equal(wrapper.classList.contains("vx-settings-option-disabled"), true);

  upload.checked = true;
  upload.dispatchEvent(new Event("change", { bubbles: true }));
  assert.equal(clientId.disabled, false);
  assert.equal(wrapper.classList.contains("vx-settings-option-disabled"), false);
  clientId.value = "updated456";
  upload.checked = false;
  upload.dispatchEvent(new Event("change", { bubbles: true }));
  assert.equal(clientId.disabled, true);
  assert.equal(clientId.value, "updated456");

  document.querySelector('.v2p-modal-footer button[type="button"]').click();
  assert.equal(store.options().upload, false);
  assert.equal(store.options().imgurClientId, "updated456");
  window.close();
});

test("guest settings retain saved preferences and show account dependencies", () => {
  dom('<html lang="zh-CN">');
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
  assert.match(document.querySelector(".v2p-modal-title").textContent, /脚本设置/);
  assert.match(document.querySelector(".vx-settings-notice").textContent, /登录 V2EX/);
  for (const key of ["autoCheckIn", "emoji", "upload", "imgurClientId"]) {
    const control = document.querySelector(`[name="${key}"]`);
    assert.equal(control.disabled, true);
    assert.equal(control.checked, false);
    assert.match(control.closest("label").querySelector("small").textContent, /需要登录 V2EX/);
  }
  document.querySelector('[name="preloadPages"]').value = "1";
  assert.equal(document.querySelector('[name="theme"]').disabled, false);
  document.querySelector('[name="theme"]').value = "vscode";
  document
    .querySelector("form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  assert.deepEqual(saved, { ...original, preloadPages: 1, theme: "vscode" });
  document.querySelector(".v2p-modal-close-btn").click();
});

test("invalid preload values cannot overwrite saved settings", () => {
  dom("");
  const api = memoryAPI(),
    store = createStorage(api);
  openSettings(store);
  document.querySelector('[name="preloadPages"]').value = "99";
  document.querySelector("#vx-settings-tab-images").click();
  document
    .querySelector("form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(api.writes.length, 0);
  assert.equal(
    document.querySelector("#vx-settings-tab-general").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(document.activeElement.name, "preloadPages");
  document.querySelector(".v2p-modal-close-btn").click();
});

test("Apply saves across tabs and keeps the settings panel open", () => {
  const { window } = dom("");
  const store = createStorage(memoryAPI());
  store.saveOptions({ hotReplies: false, hotRepliesLimit: 4 });
  openSettings(store, true);
  const dialog = document.querySelector("#vx-settings-dialog");
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
  const images = dialog.querySelector("#vx-settings-tab-images");
  images.click();
  dialog.querySelector('[name="imgurClientId"]').value = "custom123";
  dialog.querySelector('[name="contentFilter"]').checked = true;
  dialog.querySelector('[name="filterMode"]').value = "hide";
  dialog.querySelector('[name="filterKeywords"]').value = "spam\n广告\nspam";
  dialog.querySelector('.v2p-modal-footer button[type="button"]').click();
  assert.equal(store.options().theme, "native");
  assert.equal(store.options().hotRepliesLimit, 2);
  assert.equal(store.options().hotReplies, true);
  assert.equal(store.options().imgurClientId, "custom123");
  assert.equal(store.options().contentFilter, true);
  assert.equal(store.options().filterMode, "hide");
  assert.deepEqual(store.options().filterKeywords, ["spam", "广告"]);
  hotLimit.value = "0";
  dialog.querySelector('.v2p-modal-footer button[type="button"]').click();
  assert.equal(store.options().hotReplies, false);
  assert.equal(store.options().hotRepliesLimit, 2);
  assert.equal(store.options().base64Decode, false);
  assert.equal(dialog.isConnected, true);
  assert.equal(images.getAttribute("aria-selected"), "true");
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
      [
        "theme",
        "newTab",
        "autoCheckIn",
        "preview",
        "userCards",
        "autoFold",
        "base64Decode",
        "hotReplies",
        "preloadPages",
        "emoji",
        "replyPreview",
        "imgurProxy",
      ],
      ["contentFilter", "filterTopics", "filterReplies", "filterMode", "filterKeywords"],
      ["upload", "imgurClientId"],
      ["tags"],
      [],
      [],
    ],
  );
  const theme = panels[0].querySelector('[name="theme"]');
  theme.value = "vscode";
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
  assert.equal(theme.value, "vscode");
  document.querySelector(".v2p-modal-close-btn").click();
  window.close();
});
