import { button, currentUser, element, modal, owned } from "./dom.js";
import { interfaceLanguage, LANGUAGE_NAMES, t } from "./i18n.js";
import { createTagManager } from "./tag-manager.js";
import { openUploadHistory } from "./upload.js";
import { icon } from "./icons.js";
import { THEMES } from "./theme.js";
import { createBackup } from "./backup-ui.js";
import { DEFAULT_IMGUR_PROXY_URL, normalizeImgurProxyURL } from "./imgur-proxy.js";
import { MAX_HOT_REPLIES } from "./storage.js";

export function openSettings(store, signedIn = Boolean(currentUser()), tagActions) {
  if (document.querySelector("#vx-settings-dialog")) return;
  const options = store.options();
  const dialog = modal(`V2EX Kit ${t("settings")}`, true);
  dialog.root.id = "vx-settings-dialog";
  dialog.root.lang = interfaceLanguage();
  const form = element("form");
  form.id = "vx-settings-form";
  form.noValidate = true;
  const tablist = element("div", undefined, "vx-settings-tabs");
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", t("settings"));
  dialog.content.before(tablist);
  const tabs = [];
  function activate(index, focus = false) {
    tabs.forEach(({ tab, panel }, position) => {
      const selected = position === index;
      tab.tabIndex = selected ? 0 : -1;
      tab.setAttribute("aria-selected", String(selected));
      panel.hidden = !selected;
    });
    dialog.content.scrollTop = 0;
    if (focus) tabs[index].tab.focus();
  }
  function addPanel(key) {
    const panel = element("section", undefined, "vx-settings-panel");
    const index = tabs.length;
    const tab = element("button", t(key));
    tab.type = "button";
    tab.addEventListener("click", () => activate(index));
    tab.id = `vx-settings-tab-${key}`;
    panel.id = `vx-settings-panel-${key}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    tabs.push({ tab, panel });
    tablist.append(tab);
    form.append(panel);
    return panel;
  }
  tablist.addEventListener("keydown", (event) => {
    const index = tabs.findIndex(({ tab }) => tab === event.target);
    if (index < 0) return;
    const next = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    activate(next, true);
  });
  function reveal(control) {
    activate(tabs.findIndex(({ panel }) => panel.contains(control)));
    control.focus();
  }
  const fields = new Map();
  const groups = {
    general: ["language", "newTab", "autoCheckIn"],
    display: [
      "theme",
      "preview",
      "userCards",
      "autoFold",
      "hotReplies",
      "hotRepliesLimit",
      "preloadPages",
      "emoji",
    ],
    images: ["imgurProxy", "imgurProxyUrl", "upload", "imgurClientId"],
    settingsTags: ["tags"],
  };
  const panels = {};
  const requiresLogin = new Set(["autoCheckIn", "emoji", "upload", "imgurClientId"]);
  for (const [group, keys] of Object.entries(groups)) {
    const panel = (panels[group] = addPanel(group));
    const grid = element("div", undefined, "vx-settings-grid");
    const uploads = group === "images" ? element("div", undefined, "vx-settings-grid") : null;
    for (const key of keys) {
      const login = requiresLogin.has(key);
      const wrapper = element("div", undefined, "vx-settings-option");
      const caption = element("label");
      const name = element("span", t(key));
      const control = element(
        ["language", "theme", "hotRepliesLimit"].includes(key) ? "select" : "input",
      );
      control.id = `vx-option-${key}`;
      control.name = key;
      control.disabled = login && !signedIn;
      if (key === "language") {
        for (const [value, name] of [
          ...Object.entries(LANGUAGE_NAMES),
          ["site", t("followSite")],
        ]) {
          const option = element("option", name);
          option.value = value;
          if (value !== "site") option.lang = value;
          control.append(option);
        }
        control.value = options.language;
      } else if (key === "theme") {
        for (const value of THEMES) {
          const label = {
            geist: "Geist",
            claude: "Claude",
            vscode: "VS Code",
          }[value];
          const option = element(
            "option",
            label ??
              t(
                {
                  "plus-emerald": "themePlusEmerald",
                  native: "themeNative",
                }[value],
              ),
          );
          option.value = value;
          control.append(option);
        }
        control.value = options.theme;
      } else if (key === "hotRepliesLimit") {
        for (let count = 1; count <= MAX_HOT_REPLIES; count++) {
          const option = element("option", String(count));
          option.value = String(count);
          control.append(option);
        }
        control.value = String(options.hotRepliesLimit);
      } else if (key === "preloadPages") {
        Object.assign(control, { type: "number", min: "0", max: "5", step: "1", required: true });
        control.value = String(options[key]);
      } else if (key === "imgurClientId") {
        Object.assign(control, { type: "text", autocomplete: "off", pattern: "[A-Za-z0-9]{0,64}" });
        control.value = options[key];
        control.placeholder = t("sharedClient");
      } else if (key === "imgurProxyUrl") {
        Object.assign(control, {
          type: "text",
          inputMode: "url",
          autocomplete: "off",
          spellcheck: false,
          value: options[key],
          placeholder: DEFAULT_IMGUR_PROXY_URL,
        });
      } else {
        control.type = "checkbox";
        control.checked = !control.disabled && options[key];
      }
      if (control.disabled) name.append(element("small", t("loginRequired")));
      caption.append(name, control);
      const help = element("p", t(`${key}Help`));
      help.id = `${control.id}-help`;
      control.setAttribute("aria-describedby", help.id);
      wrapper.append(caption, help);
      (uploads && (key === "upload" || key === "imgurClientId") ? uploads : grid).append(wrapper);
      fields.set(key, control);
    }
    if (uploads) {
      for (const [key, controls] of [
        ["imageProxyGroup", grid],
        ["imageUploadGroup", uploads],
      ]) {
        const section = element("fieldset", undefined, "vx-image-settings");
        section.append(element("legend", t(key)), controls);
        panel.append(section);
      }
      panel.append(button(t("uploadHistory"), () => openUploadHistory(store)));
    } else panel.append(grid);
  }
  const message = element("p");
  message.setAttribute("role", "status");
  const save = element("button", t("save"), "normal button special");
  save.type = "submit";
  save.setAttribute("form", form.id);
  dialog.footer.append(
    message,
    button(t("apply"), () => persist(false)),
    save,
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    persist(true);
  });
  function persist(refresh) {
    message.textContent = "";
    const invalid = [...fields.values()].find((control) => !control.validity.valid);
    if (invalid) {
      reveal(invalid);
      invalid.reportValidity();
      return;
    }
    const next = { ...store.options() };
    for (const [key, control] of fields) {
      if (control.disabled) continue;
      next[key] = control.type === "checkbox" ? control.checked : control.value;
    }
    next.preloadPages = Number(next.preloadPages);
    next.hotRepliesLimit = Number(next.hotRepliesLimit);
    if (next.imgurProxyUrl.trim() && !normalizeImgurProxyURL(next.imgurProxyUrl)) {
      message.textContent = t("imgurProxyUrlInvalid");
      reveal(fields.get("imgurProxyUrl"));
      return;
    }
    try {
      store.saveOptions(next);
      if (refresh) location.reload();
      else message.textContent = t("settingsApplied");
    } catch {
      message.textContent = t("saveFailed");
    }
  }
  let manager;
  const backup = createBackup(store, {
    signedIn,
    onTags: tagActions?.updateTags,
    onRestored(settings) {
      manager?.refresh();
      if (!settings) return;
      const restored = store.options();
      for (const [key, control] of fields) {
        if (control.disabled) continue;
        if (control.type === "checkbox") control.checked = restored[key];
        else control.value = restored[key];
      }
    },
  });
  if (tagActions) {
    const details = element("details", undefined, "vx-settings-tag-manager");
    details.append(element("summary", t("manageTags")));
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      if (!manager) {
        manager = createTagManager(store, tagActions);
        details.append(manager.root);
      }
      manager.refresh();
    });
    panels.settingsTags.append(details);
  }
  addPanel("backup").append(backup);
  if (!signedIn) dialog.content.append(element("p", t("guestNotice"), "vx-settings-notice"));
  dialog.content.append(form);
  activate(0);
}

export function installSettings(store, signedIn, tagActions) {
  const open = () => openSettings(store, signedIn, tagActions);
  GM_registerMenuCommand(`V2EX Kit ${t("settings")}`, open);
  const shortcut = owned(element("div", undefined, "vx-settings-shortcut"));
  const controls = element("div", undefined, "vx-page-actions");
  const trigger = button("", open);
  trigger.className = "vx-open-settings";
  trigger.setAttribute("aria-label", t("settings"));
  const hint = element("span", t("settings"), "vx-page-action-hint");
  hint.setAttribute("aria-hidden", "true");
  trigger.append(icon("settings"), hint);
  controls.append(trigger);
  shortcut.append(controls);
  document.body.append(shortcut);
  const nav = document.querySelector("#Top .tools, #menu-body .cell, #site-header");
  if (!nav) return;
  const entry = owned(element("a", "V2EX Kit", "top"));
  entry.id = "vx-settings";
  entry.href = "#vx-settings-dialog";
  entry.setAttribute("aria-haspopup", "dialog");
  entry.setAttribute("aria-label", `V2EX Kit ${t("settings")}`);
  entry.title = entry.getAttribute("aria-label");
  entry.addEventListener("click", (event) => {
    event.preventDefault();
    open();
  });
  const home = nav.querySelector('a.top[href="/"]');
  if (home) home.before(entry);
  else nav.prepend(entry);
}
