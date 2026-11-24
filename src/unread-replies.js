import { element, matching, owned, whenPageIdle } from "./dom.js";
import { t } from "./i18n.js";
import { REPLY } from "./reply-actions.js";

export const READ_HISTORY_KEY = "read-history";
export const MAX_READ_HISTORY = 500;
const DAY_SECONDS = 86_400;
const SAVE_DELAY_MS = 1500;

export function topicIdFromPath(pathname) {
  return /^\/t\/(\d+)\/?$/.exec(pathname ?? "")?.[1] ?? null;
}

export function replyNumericId(node) {
  const id = Number(/^r_(\d+)$/.exec(node?.id ?? "")?.[1] ?? "0");
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export function replyFloor(node) {
  const raw = node?.querySelector?.(".no")?.textContent?.trim() ?? "";
  const floor = Number.parseInt(raw, 10);
  return Number.isInteger(floor) && floor > 0 ? floor : 0;
}

export function topicReplyTotal(doc) {
  const main = doc.getElementById?.("Main") ?? doc;
  for (const span of main.querySelectorAll(".box > .cell > .gray, .box > .cell > span.gray")) {
    if (span.closest(".header, [data-vx-owned]")) continue;
    const match = /(\d[\d,]*)\s*(?:条?回复|repl(?:y|ies))/i.exec(span.textContent ?? "");
    if (match) {
      const count = Number.parseInt(match[1].replace(/,/g, ""), 10);
      if (Number.isInteger(count) && count >= 0) return count;
    }
  }
  return 0;
}

export function readRecord(history, topicId) {
  if (!history || typeof history !== "object" || !topicId || !Object.hasOwn(history, topicId))
    return null;
  const entry = history[topicId];
  if (!Array.isArray(entry) || entry.length < 2) return null;
  const maxId = Number(entry[0]);
  const count = Number(entry[1]);
  const updatedAt = Number(entry[2] ?? 0);
  if (
    !Number.isSafeInteger(maxId) ||
    maxId < 0 ||
    !Number.isInteger(count) ||
    count < 0 ||
    !Number.isFinite(updatedAt)
  )
    return null;
  return { maxId, count, updatedAt };
}

export function updateHistoryMap(
  history,
  topicId,
  { maxId = 0, count = 0, now = Math.floor(Date.now() / 1000) } = {},
) {
  if (!topicId || !/^\d+$/.test(String(topicId))) return null;
  const safeMaxId = Number.isSafeInteger(maxId) && maxId >= 0 ? maxId : 0;
  const safeCount = Number.isInteger(count) && count >= 0 ? count : 0;
  const prev = readRecord(history, topicId);
  const nextMaxId = Math.max(prev?.maxId ?? 0, safeMaxId);
  const nextCount = Math.max(prev?.count ?? 0, safeCount);
  if (
    prev &&
    nextMaxId === prev.maxId &&
    nextCount === prev.count &&
    now - prev.updatedAt < DAY_SECONDS
  )
    return null;

  const entries = [];
  if (history && typeof history === "object") {
    for (const key of Object.keys(history)) {
      if (key === topicId || !/^\d+$/.test(key)) continue;
      const parsed = readRecord(history, key);
      if (parsed) entries.push([key, [parsed.maxId, parsed.count, parsed.updatedAt]]);
    }
  }
  entries.push([topicId, [nextMaxId, nextCount, now]]);
  if (entries.length > MAX_READ_HISTORY) {
    entries.sort(([, a], [, b]) => a[2] - b[2]);
    entries.splice(0, entries.length - MAX_READ_HISTORY);
  }
  return Object.fromEntries(entries);
}

function appendUnreadBadge(node, doc) {
  if (node.querySelector(".vx-unread-badge")) return;
  const badge = owned(element("span", t("unreadReplyBadge"), "vx-unread-badge", doc));
  const row = [...node.querySelectorAll(".flex-one-row > .flex-one-row:first-child")].find(
    (el) => el.closest(REPLY) === node && !el.closest(".reply_content"),
  );
  if (row) {
    row.append(badge);
    return;
  }
  const header = [...node.querySelectorAll("strong")].find(
    (el) => el.closest(REPLY) === node && !el.closest(".reply_content"),
  );
  const container = header?.parentElement;
  const target = container?.querySelector(".fr .no, .no");
  if (target) target.before(badge);
  else header?.after(badge);
}

function findDividerAnchor(firstUnread) {
  const group = firstUnread.closest(".reply-group");
  if (group) {
    const firstInGroup = group.querySelector(REPLY);
    if (firstInGroup === firstUnread) return group;
  }
  return firstUnread;
}

export function createTopicUnread({
  store,
  doc = document,
  totalPages = 1,
  currentPage = 1,
  currentAccount = null,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  const pathname = doc.location?.pathname ?? location.pathname;
  const topicId = topicIdFromPath(pathname);
  if (!topicId || !store) return null;

  const view = doc.defaultView ?? globalThis;
  const baseline = readRecord(store.get(READ_HISTORY_KEY, {}), topicId);
  let seenMaxId = baseline?.maxId ?? 0;
  let seenCount = Math.max(
    baseline?.count ?? 0,
    totalPages <= 1 || currentPage >= totalPages ? topicReplyTotal(doc) : 0,
  );
  let total = totalPages;
  let reachEnd = total <= 1 || currentPage >= total;
  let dirty = !baseline || seenMaxId > baseline.maxId || seenCount > baseline.count;
  let wasVisible = doc.visibilityState === "visible";
  let destroyed = false;
  let saveTimer = null;
  let cancelIdle = null;
  let divider = null;
  let jumpCursor = -1;
  const preloadedMeta = new WeakMap();
  const selfName = currentAccount?.toLowerCase() ?? null;

  function markSeen(id, floor) {
    if (id > seenMaxId) {
      seenMaxId = id;
      dirty = true;
    }
    if (floor > seenCount) {
      seenCount = floor;
      dirty = true;
    }
    if (reachEnd) {
      const headerTotal = topicReplyTotal(doc);
      if (headerTotal > seenCount) {
        seenCount = headerTotal;
        dirty = true;
      }
    }
  }

  function flush() {
    if (!wasVisible || !dirty) return false;
    if (saveTimer !== null) {
      view.clearTimeout?.(saveTimer);
      saveTimer = null;
    }
    const current = store.get(READ_HISTORY_KEY, {});
    const next = updateHistoryMap(current, topicId, {
      maxId: seenMaxId,
      count: seenCount,
      now: now(),
    });
    dirty = false;
    if (!next) return false;
    try {
      store.set(READ_HISTORY_KEY, next);
      return true;
    } catch {
      return false;
    }
  }

  function scheduleFlush() {
    if (destroyed || !wasVisible || !dirty || saveTimer !== null) return;
    saveTimer = view.setTimeout(() => {
      saveTimer = null;
      flush();
    }, SAVE_DELAY_MS);
  }

  const intersection =
    typeof view.IntersectionObserver === "function"
      ? new view.IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const meta = preloadedMeta.get(entry.target);
            intersection.unobserve(entry.target);
            if (!meta) continue;
            markSeen(meta.id, meta.floor);
            scheduleFlush();
          }
        })
      : null;

  function observe(node, isPreloaded = false, authorName = null) {
    if (!node || node.closest("[data-vx-owned]") || !node.closest("#Main")) return;
    const id = replyNumericId(node);
    const floor = replyFloor(node);
    const isSelf = selfName && authorName && authorName.toLowerCase() === selfName;
    if (baseline !== null && id > baseline.maxId && !isSelf && node.dataset.vxUnread !== "1") {
      node.classList.add("vx-reply-unread");
      node.dataset.vxUnread = "1";
      appendUnreadBadge(node, doc);
    }
    if (!isPreloaded) {
      markSeen(id, floor);
      scheduleFlush();
    } else if (intersection) {
      preloadedMeta.set(node, { id, floor });
      intersection.observe(node);
    }
  }

  function markPageVisited(page, nextTotal = total, nodes = []) {
    total = Math.max(total, nextTotal);
    if (page >= total) reachEnd = true;
    for (const node of nodes) {
      intersection?.unobserve(node);
      markSeen(replyNumericId(node), replyFloor(node));
    }
    if (reachEnd) markSeen(0, topicReplyTotal(doc));
    scheduleFlush();
  }

  function orderedUnread() {
    const main = doc.getElementById?.("Main") ?? doc;
    return [...main.querySelectorAll(`${REPLY}[data-vx-unread]`)].filter(
      (node) => !node.closest("[data-vx-owned]") && !node.hidden && node.style.display !== "none",
    );
  }

  function placeDivider() {
    const nodes = orderedUnread();
    if (!nodes.length) {
      divider?.remove();
      divider = null;
      return 0;
    }
    const anchor = findDividerAnchor(nodes[0]);
    if (!divider) {
      divider = owned(element("div", undefined, "cell vx-unread-divider", doc));
      divider.append(element("span", t("unreadDivider"), undefined, doc));
    }
    if (anchor.previousElementSibling !== divider) anchor.before(divider);
    return nodes.length;
  }

  function jumpNext(onBeforeJump) {
    const nodes = orderedUnread();
    if (!nodes.length) return false;
    jumpCursor = (jumpCursor + 1) % nodes.length;
    const target = nodes[jumpCursor];
    onBeforeJump?.(target);
    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target.classList.add("vx-unread-flash");
    view.setTimeout?.(() => target.classList.remove("vx-unread-flash"), 1200);
    return true;
  }

  function destroy() {
    destroyed = true;
    cancelIdle?.();
    if (saveTimer !== null) {
      view.clearTimeout?.(saveTimer);
      saveTimer = null;
    }
    intersection?.disconnect();
    doc.removeEventListener?.("visibilitychange", onVisibility);
    view.removeEventListener?.("pagehide", onPageHide);
  }

  function onVisibility() {
    if (doc.visibilityState === "visible") {
      wasVisible = true;
      scheduleFlush();
    } else if (doc.visibilityState === "hidden" && wasVisible) {
      flush();
    }
  }

  function onPageHide(event) {
    if (wasVisible) flush();
    if (!event.persisted) destroy();
  }

  doc.addEventListener?.("visibilitychange", onVisibility);
  view.addEventListener?.("pagehide", onPageHide);
  if (wasVisible && dirty) cancelIdle = whenPageIdle(scheduleFlush, doc);

  return {
    topicId,
    baseline,
    observe,
    markPageVisited,
    placeDivider,
    jumpNext,
    flush,
    destroy,
    get unreadCount() {
      return orderedUnread().length;
    },
  };
}

export function enhanceUnreadList(root, store) {
  if (!root || !store) return;
  const history = store.get(READ_HISTORY_KEY, {});
  if (!history || typeof history !== "object" || !Object.keys(history).length) return;
  const doc = root.ownerDocument ?? document;
  const baseHref = doc.location?.href ?? location.href;
  const origin = new URL(baseHref).origin;

  for (const row of matching(root, ".cell.item, .item")) {
    if (row.closest("[data-vx-owned]")) continue;
    const link = row.querySelector(".item_title a[href], a.topic-link[href]");
    if (!link) continue;
    let url;
    try {
      url = new URL(link.getAttribute("href"), baseHref);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    const topicId = topicIdFromPath(url.pathname);
    const record = readRecord(history, topicId);
    if (!record) continue;

    const countNode = row.querySelector("a.count_livid, a.count_orange");
    const hashCount = /^#reply(\d+)$/.exec(url.hash)?.[1];
    const currentCount = Number.parseInt(countNode?.textContent?.trim() ?? hashCount ?? "", 10);
    if (!Number.isInteger(currentCount) || currentCount <= record.count) continue;

    const diff = currentCount - record.count;
    const existing = row.querySelector(".vx-list-unread");
    const badge = existing ?? owned(element("span", undefined, "vx-list-unread", doc));
    badge.textContent = t("unreadListBadge", diff);
    badge.title = t("unreadListBadgeTitle", diff);
    if (!existing) {
      const host = row.querySelector(".topic_info, .v2p-mobile-topic-meta") ?? link.parentElement;
      host?.append(badge);
    }
  }
}
