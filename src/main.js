import { applyTheme, THEME_STYLE_ID } from "./theme.js";
import { themeStyles } from "./theme-styles.js";
import { enhanceEmojis, initEmoji } from "./emoji.js";
import { createStorage, PREFIX } from "./storage.js";
import { createHTTP, currentUser, isV2EXPage, matching, whenPageIdle } from "./dom.js";
import { createMembers } from "./members.js";
import { createTopics } from "./preview.js";
import { enhanceReplyActions, initReplies, REPLY } from "./replies.js";
import { createCheckIn } from "./check-in.js";
import { initUpload } from "./upload.js";
import { createReplyFolding } from "./folding.js";
import { installSettings } from "./settings.js";
import { installPageActions } from "./page-actions.js";
import { enhanceImages, installImageViewer } from "./image-viewer.js";
import { installImgurProxy } from "./imgur-proxy.js";
import { installPlusNavigation } from "./plus-navigation.js";
import { enhanceBase64 } from "./base64.js";
import { createContentFilter } from "./content-filter.js";
import { initReplyPreview } from "./reply-preview.js";

let themeReady = false;

function prepareTheme() {
  if (!themeReady && (document.querySelector("body > #Top #Logo") || isV2EXPage(document))) {
    let theme;
    try {
      theme = GM_getValue(`${PREFIX}options`, {})?.theme;
    } catch {
      // A storage failure must not prevent the fallback theme from loading.
    }
    applyTheme(document, theme);
    if (!document.getElementById(THEME_STYLE_ID)) {
      const style = GM_addStyle(themeStyles(document.documentElement.dataset.vxTheme));
      if (style) style.id = THEME_STYLE_ID;
    }
    themeReady = true;
  }
  return themeReady;
}

function start() {
  if (!isV2EXPage(document)) return;
  prepareTheme();
  applyTheme(document);
  const store = createStorage({
    get: GM_getValue,
    set: GM_setValue,
    delete: GM_deleteValue,
    keys: GM_listValues,
    listen: GM_addValueChangeListener,
  });
  const options = store.options();
  const name = currentUser();
  const getDocument = createHTTP();
  const topics = createTopics(options, getDocument);
  const members = createMembers(store, options, topics, name);
  const folding = createReplyFolding(options.autoFold);
  const contentFilter = createContentFilter(options);
  if (options.theme === "plus-emerald") installPlusNavigation(document);
  const main = document.getElementById("Main");
  const isTopic = document.documentElement.dataset.v2pPage === "topic";
  if (isTopic) installImageViewer(main);
  const enhance = (root) => {
    members.enhance(root);
    topics.enhance(root);
    enhanceEmojis(root);
    if (isTopic) enhanceImages(root);
    enhanceReplyActions(root);
    folding.enhance(root);
    if (options.base64Decode) enhanceBase64(root);
    contentFilter.enhance(root);
  };
  enhance(document);
  if (options.imgurProxy) installImgurProxy(document, options.imgurProxyUrl);
  const replies = initReplies({ options, getDocument, enhance });
  installPageActions(Boolean(name));
  installSettings(store, Boolean(name), members);
  if (name) {
    initEmoji(options);
    initUpload(options, store);
  }
  initReplyPreview(options);
  if (main) {
    const roots = new Set();
    const changed = new Set();
    let scheduled = false;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target =
          mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
        if (mutation.type === "attributes") {
          if (target?.matches(REPLY)) changed.add(target);
          continue;
        }
        const reply = target?.closest(REPLY);
        if (reply) {
          replies?.invalidate(reply);
          changed.add(reply);
        }
        for (const node of mutation.removedNodes)
          if (node.nodeType === 1)
            for (const removed of matching(node, REPLY)) changed.add(removed);
        if (target?.closest("[data-vx-owned]")) continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 && !node.matches("[data-vx-owned]")) roots.add(node);
        }
      }
      if (scheduled || (!roots.size && !changed.size)) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        for (const root of roots) {
          if (root.isConnected) {
            enhance(root);
            replies?.add(root);
          }
        }
        for (const node of changed)
          if (node.isConnected) {
            folding.enhance(node);
            contentFilter.enhance(node);
          }
        replies?.update(changed);
        roots.clear();
        changed.clear();
      });
    });
    observer.observe(main, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });
  }
  if (name && options.autoCheckIn) {
    const report = (message) => {
      const entry = document.querySelector("#vx-settings");
      if (entry) entry.title = message;
      console.info(`[V2EX Kit] ${message}`);
    };
    const checkIn = createCheckIn({ store, getDocument, onStatus: report });
    const runDaily = () => {
      if (document.visibilityState === "visible")
        void checkIn(name).catch((error) => report(error.message));
    };
    document.addEventListener("visibilitychange", runDaily);
    whenPageIdle(runDaily);
  }
  whenPageIdle(() => void replies?.preload());
}

if (window.self === window.top) {
  if (document.readyState === "loading") {
    const observer = new MutationObserver(() => {
      if (prepareTheme()) observer.disconnect();
    });
    if (!prepareTheme()) observer.observe(document, { childList: true, subtree: true });
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        observer.disconnect();
        start();
      },
      { once: true },
    );
  } else start();
}
