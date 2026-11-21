import { button, element, matching, owned } from "./dom.js";
import { t } from "./i18n.js";
import { REPLY } from "./reply-actions.js";

const TOPIC_LINKS =
  ".item_title a[href],a.topic-link[href],.item_hot_topic_title > a[href],a.v2p-member-topic-item[href]";
const FILTER_CLASSES = [
  "vx-content-filtered",
  "vx-filter-collapse",
  "vx-filter-hide",
  "vx-filter-revealed",
];

function normalized(value) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

function topicTarget(link) {
  return (
    link.closest(".cell.item,.item,.topic-item,li") ??
    link.closest(".item_title,.item_hot_topic_title,.v2p-member-topic-item-row")
  );
}

function replyText(reply) {
  return [...reply.querySelectorAll(".reply_content")]
    .filter((content) => content.closest(REPLY) === reply)
    .map((content) => content.textContent)
    .join("\n");
}

export function createContentFilter(options) {
  const keywords = options.contentFilter
    ? options.filterKeywords.map((value) => ({ label: value, match: normalized(value) }))
    : [];
  const states = new WeakMap();

  function findKeyword(text) {
    if (!text || !keywords.length) return null;
    const haystack = normalized(text);
    return keywords.find(({ match }) => haystack.includes(match))?.label ?? null;
  }

  function clear(target) {
    const state = states.get(target);
    state?.notice?.remove();
    if (state?.hiddenByFilter && !state.wasHidden) target.hidden = false;
    target.classList.remove(...FILTER_CLASSES);
    target.removeAttribute("data-vx-filtered");
    states.delete(target);
  }

  function apply(target, keyword) {
    const previous = states.get(target);
    if (previous?.keyword === keyword && previous.mode === options.filterMode) return;
    clear(target);
    const state = {
      keyword,
      mode: options.filterMode,
      wasHidden: target.hidden,
      hiddenByFilter: false,
      notice: null,
    };
    states.set(target, state);
    target.classList.add("vx-content-filtered", `vx-filter-${options.filterMode}`);
    target.dataset.vxFiltered = "";
    if (options.filterMode === "hide") {
      state.hiddenByFilter = true;
      target.hidden = true;
      return;
    }
    const notice = owned(element("span", undefined, "vx-filter-notice"));
    const status = element("span", t("contentFiltered"));
    const toggle = button(t("showFiltered"), () => {
      const revealed = target.classList.toggle("vx-filter-revealed");
      toggle.textContent = revealed ? t("filterAgain") : t("showFiltered");
      toggle.setAttribute("aria-expanded", String(revealed));
    });
    toggle.setAttribute("aria-expanded", "false");
    notice.append(status, toggle);
    target.prepend(notice);
    state.notice = notice;
  }

  function filterTopics(root) {
    if (!options.filterTopics) return;
    for (const link of matching(root, TOPIC_LINKS)) {
      if (link.closest("[data-vx-owned]")) continue;
      let url;
      try {
        url = new URL(link.getAttribute("href"), location.href);
      } catch {
        continue;
      }
      if (url.origin !== location.origin || !/^\/t\/\d+\/?$/.test(url.pathname)) continue;
      const target = topicTarget(link);
      if (!target) continue;
      const keyword = findKeyword(link.textContent);
      if (keyword) apply(target, keyword);
      else if (states.has(target)) clear(target);
    }
  }

  function filterReplies(root) {
    if (!options.filterReplies) return;
    for (const reply of matching(root, REPLY)) {
      if (reply.closest("[data-vx-owned]")) continue;
      const keyword = findKeyword(replyText(reply));
      if (keyword) apply(reply, keyword);
      else if (states.has(reply)) clear(reply);
    }
  }

  return {
    enhance(root) {
      if (!keywords.length) return;
      filterTopics(root);
      filterReplies(root);
    },
  };
}
