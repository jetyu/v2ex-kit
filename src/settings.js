import { button, currentUser, element, modal, owned } from "./dom.js";
import { t } from "./i18n.js";
import { createTagManager } from "./tag-manager.js";
import { createUploadHistory } from "./upload.js";
import { icon } from "./icons.js";
import { THEMES } from "./theme.js";
import { createBackup } from "./backup-ui.js";
import {
  FILTER_LIMITS,
  FILTER_MODES,
  MAX_HOT_REPLIES,
  MAX_PRELOAD_PAGES,
  normalizeFilterKeywords,
} from "./storage.js";
import { createAbout } from "./about.js";

function hotReplySelection(options) {
  return String(options.hotReplies ? options.hotRepliesLimit : 0);
}

export function openSettings(store, signedIn = Boolean(currentUser()), tagActions) {
  if (document.querySelector("#vx-settings-dialog")) return;
  const options = store.options();
  const dialog = modal(`V2EX Kit ${t("settings")}`, true);
  dialog.root.id = "vx-settings-dialog";
  dialog.root.lang = "zh-CN";
  const form = element("form");
  form.id = "vx-settings-form";
  form.noValidate = true;
  const tablist = element("div", undefined, "vx-settings-tabs");
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", t("settings"));
  dialog.content.before(tablist);
  const tabs = [];
  function activate(index, focus = false) {
    tabs.forEach((entry, position) => {
      const { tab, panel } = entry;
      const selected = position === index;
      tab.tabIndex = selected ? 0 : -1;
      tab.setAttribute("aria-selected", String(selected));
      panel.hidden = !selected;
      if (selected) entry.onActivate?.();
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
    tabs.push({ tab, panel, onActivate: undefined });
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
    general: [
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
    filtering: ["contentFilter", "filterTopics", "filterReplies", "filterMode", "filterKeywords"],
    images: ["upload", "imgurClientId"],
    settingsTags: ["tags"],
  };
  const panels = {};
  const requiresLogin = new Set(["autoCheckIn", "emoji", "upload", "imgurClientId"]);
  const filterDependencies = ["filterTopics", "filterReplies", "filterMode", "filterKeywords"];
  for (const [group, keys] of Object.entries(groups)) {
    const panel = (panels[group] = addPanel(group));
    const grid = element("div", undefined, "vx-settings-grid");
    for (const key of keys) {
      const login = requiresLogin.has(key);
      const wrapper = element("div", undefined, "vx-settings-option");
      const caption = element("label");
      const name = element("span", t(key));
      const control = element(
        key === "filterKeywords"
          ? "textarea"
          : ["theme", "hotReplies", "preloadPages", "filterMode"].includes(key)
            ? "select"
            : "input",
      );
      control.id = `vx-option-${key}`;
      control.name = key;
      control.disabled = login && !signedIn;
      if (key === "theme") {
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
      } else if (key === "hotReplies" || key === "preloadPages") {
        const hot = key === "hotReplies";
        const max = hot ? MAX_HOT_REPLIES : MAX_PRELOAD_PAGES;
        control.required = true;
        for (let count = 0; count <= max; count++) {
          const option = element("option", count === 0 ? t("off") : String(count));
          option.value = String(count);
          control.append(option);
        }
        control.value = hot ? hotReplySelection(options) : String(options[key]);
      } else if (key === "filterMode") {
        for (const value of FILTER_MODES) {
          const option = element("option", t(`filterMode_${value}`));
          option.value = value;
          control.append(option);
        }
        control.value = options.filterMode;
      } else if (key === "filterKeywords") {
        control.rows = 8;
        control.maxLength = FILTER_LIMITS.total;
        control.placeholder = t("filterKeywordsPlaceholder");
        control.value = options.filterKeywords.join("\n");
      } else if (key === "imgurClientId") {
        Object.assign(control, { type: "text", autocomplete: "off", pattern: "[A-Za-z0-9]{0,64}" });
        control.value = options[key];
        control.placeholder = t("sharedClient");
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
      grid.append(wrapper);
      fields.set(key, control);
    }
    panel.append(grid);
    if (group === "images") {
      const history = element("section", undefined, "vx-upload-history");
      history.append(element("h2", t("uploadHistory")));
      panel.append(history);
      const entry = tabs.at(-1);
      entry.onActivate = () => {
        entry.onActivate = undefined;
        history.append(createUploadHistory(store, entry.tab));
      };
    }
  }
  const contentFilter = fields.get("contentFilter");
  function syncFilterDependencies() {
    const disabled = !contentFilter.checked;
    for (const key of filterDependencies) {
      const control = fields.get(key);
      control.disabled = disabled;
      control
        .closest(".vx-settings-option")
        .classList.toggle("vx-settings-option-disabled", disabled);
    }
  }
  contentFilter.addEventListener("change", syncFilterDependencies);
  syncFilterDependencies();
  const upload = fields.get("upload");
  const imgurClientId = fields.get("imgurClientId");
  function syncUploadDependency() {
    const disabled = !signedIn || !upload.checked;
    imgurClientId.disabled = disabled;
    imgurClientId
      .closest(".vx-settings-option")
      .classList.toggle("vx-settings-option-disabled", disabled);
  }
  upload.addEventListener("change", syncUploadDependency);
  syncUploadDependency();
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
      if (requiresLogin.has(key) && !signedIn) continue;
      if (key === "hotReplies") {
        const count = Number(control.value);
        next.hotReplies = count > 0;
        if (next.hotReplies) next.hotRepliesLimit = count;
      } else next[key] = control.type === "checkbox" ? control.checked : control.value;
    }
    next.preloadPages = Number(next.preloadPages);
    next.filterKeywords = normalizeFilterKeywords(next.filterKeywords);
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
        if (requiresLogin.has(key) && !signedIn) continue;
        if (key === "hotReplies") control.value = hotReplySelection(restored);
        else if (key === "filterKeywords") control.value = restored[key].join("\n");
        else if (control.type === "checkbox") control.checked = restored[key];
        else control.value = restored[key];
      }
      syncFilterDependencies();
      syncUploadDependency();
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
  addPanel("about").append(createAbout());
  if (!signedIn) dialog.content.append(element("p", t("guestNotice"), "vx-settings-notice"));
  dialog.content.append(form);
  activate(0);
}

export function installSettings(store, signedIn, tagActions) {
  const open = () => openSettings(store, signedIn, tagActions);
  GM_registerMenuCommand(`V2EX Kit ${t("settings")}`, open);
  const mobileNav = document.documentElement.hasAttribute("data-v2p-mobile")
    ? document.querySelector("#menu-body .cell")
    : null;
  const label = "V2EX Kit 设置";
  if (!mobileNav) {
    const controls = document.querySelector(".vx-page-actions");
    if (!controls) return;
    const entry = owned(button("", open));
    entry.id = "vx-settings";
    entry.className = "vx-open-settings";
    entry.setAttribute("aria-haspopup", "dialog");
    entry.setAttribute("aria-label", label);
    entry.title = label;
    const hint = element("span", label, "vx-page-action-hint");
    hint.setAttribute("aria-hidden", "true");
    entry.append(icon("settings"), hint);
    controls.append(entry);
    controls.hidden = false;
    return;
  }
  const entry = owned(element("a", label, "top vx-settings-menu"));
  entry.id = "vx-settings";
  entry.href = "#vx-settings-dialog";
  entry.setAttribute("aria-haspopup", "dialog");
  entry.setAttribute("aria-label", label);
  entry.title = label;
  entry.addEventListener("click", (event) => {
    event.preventDefault();
    open();
  });
  entry.prepend(icon("settings"));
  mobileNav.append(entry);
}
