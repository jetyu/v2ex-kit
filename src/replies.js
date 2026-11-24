import { t } from "./i18n.js";
import { button, element, matching, memberName, owned, safeURL } from "./dom.js";
import { captureImportedActions, enhanceReplyActions, REPLY } from "./reply-actions.js";
import { createPagination } from "./pagination.js";
import { normalizeHotRepliesLimit } from "./storage.js";

export { enhanceReplyActions, REPLY } from "./reply-actions.js";

export function thanksCount(node) {
  const header = node.querySelector(".flex-one-row") ?? node;
  const heart = [
    ...header.querySelectorAll('img[alt="\u2764\uFE0F"],img[src*="heart"],.v2p-icon-heart'),
  ].find((image) => image.closest(REPLY) === node && !image.closest(".reply_content"));
  const text =
    heart?.nextSibling?.textContent ?? node.querySelector(".thank_count")?.textContent ?? "";
  return Number.parseInt(text.replace(/,/g, "").match(/\d+/)?.[0] ?? "0", 10);
}

export function parseReply(node) {
  if (!/^r_\d+$/.test(node.id)) return null;
  return {
    id: node.id,
    node,
    name: memberName(node.querySelector('strong a[href^="/member/"]')) ?? "unknown",
    floor:
      Number.parseInt(node.querySelector(".no")?.textContent ?? "0", 10) ||
      Number(node.id.slice(2)),
    thanks: thanksCount(node),
  };
}

export function rankReplies(replies, limit = Infinity) {
  return [...replies]
    .filter((reply) => reply.thanks > 0)
    .sort((a, b) => b.thanks - a.thanks || a.floor - b.floor)
    .slice(0, limit);
}

function directReplyNode(reply, selector) {
  return [...reply.node.querySelectorAll(selector)].find(
    (node) => node.closest(REPLY) === reply.node,
  );
}

function replyAction(anchor) {
  if (anchor.querySelector(".v2p-control-hide")) return "hide";
  if (anchor.querySelector(".v2p-control-thank")) return "thank";
  if (anchor.querySelector(".v2p-control-reply")) return "reply";
  const source = `${anchor.getAttribute("href") ?? ""} ${anchor.getAttribute("onclick") ?? ""}`;
  if (/ignoreReply\s*\(|\/ignore\/reply\//.test(source)) return "hide";
  if (/thankReply\s*\(|\/thank\/reply\//.test(source)) return "thank";
  if (/replyOne\s*\(/.test(source)) return "reply";
  return null;
}

function bindClonedReplyActions(cloned, reply) {
  const sourceArea = directReplyNode(reply, ".thank_area");
  const clonedArea = [...cloned.querySelectorAll(".thank_area")].find(
    (area) => !area.closest(".reply_content") && area.closest(".vx-hot-reply") === cloned,
  );
  if (!clonedArea) return;
  const sourceActions = new Map();
  for (const anchor of sourceArea?.querySelectorAll("a") ?? []) {
    const action = replyAction(anchor);
    if (action && !sourceActions.has(action)) sourceActions.set(action, anchor);
  }
  for (const anchor of [...clonedArea.querySelectorAll("a")]) {
    const action = replyAction(anchor);
    const source = sourceActions.get(action);
    if (!source || action === "reply") {
      anchor.remove();
      continue;
    }
    anchor.removeAttribute("onclick");
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      if (source.isConnected) source.click();
    });
  }
}

export function pageCount(doc, path) {
  const pages = [1];
  for (const link of doc.querySelectorAll("a.page_normal[href], a.page_current[href]")) {
    const url = new URL(link.getAttribute("href"), location.href);
    const page = Number(url.searchParams.get("p"));
    if (
      url.origin === location.origin &&
      url.pathname === path &&
      Number.isInteger(page) &&
      page > 0 &&
      page <= 100_000
    )
      pages.push(page);
  }
  for (const input of doc.querySelectorAll("input.page_input[max]"))
    if (
      Number.isInteger(Number(input.max)) &&
      Number(input.max) > 0 &&
      Number(input.max) <= 100_000
    )
      pages.push(Number(input.max));
  return Math.max(...pages);
}

export function importReply(row, base) {
  const copy = row.cloneNode(true);
  captureImportedActions(copy, base);
  for (const node of copy.querySelectorAll(
    "script,style,iframe,object,embed,link,meta,base,form,input,button",
  )) {
    const treeRow = node.closest(`${REPLY}[data-depth]`);
    if (
      node.matches("button.reply-toggle,button.reply-tree-more") &&
      /^\d{1,5}$/.test(treeRow?.dataset.depth ?? "") &&
      (node.classList.contains("reply-tree-more") || node.parentElement === treeRow) &&
      !node.closest(".reply_content")
    ) {
      // Native tree actions are delegated; rebuild only their inert controls.
      const toggle = element("button", node.textContent);
      toggle.type = "button";
      toggle.className = ["reply-toggle", "reply-toggle-big", "reply-tree-more"]
        .filter((name) => node.classList.contains(name))
        .join(" ");
      for (const name of ["aria-expanded", "aria-label", "title"])
        if (node.hasAttribute(name)) toggle.setAttribute(name, node.getAttribute(name));
      node.replaceWith(toggle);
    } else node.remove();
  }
  const originPrefix = `${location.origin}/member/`;
  for (const node of [copy, ...copy.querySelectorAll("*")]) {
    const treeRow =
      node.hasAttribute("data-depth") &&
      node.classList.contains("cell") &&
      node.id.startsWith("r_");
    const treeLine =
      node.classList.contains("reply-tree-line") &&
      node.parentElement?.hasAttribute("data-depth") &&
      node.parentElement.classList.contains("cell") &&
      node.parentElement.id.startsWith("r_");
    const depth = treeRow && !node.closest(".reply_content") ? node.dataset.depth : "";
    const displayDepth = treeRow ? node.style.getPropertyValue("--depth").trim() : "";
    const level =
      treeLine && !node.closest(".reply_content")
        ? node.style.getPropertyValue("--level").trim()
        : "";
    if (node.attributes.length) {
      for (const attr of [...node.attributes]) {
        const name = attr.name;
        if (
          /^on/i.test(name) ||
          name.startsWith("data-vx-") ||
          name === "srcdoc" ||
          name === "style" ||
          name === "srcset" ||
          name === "name"
        )
          node.removeAttribute(name);
      }
    }
    if (/^\d{1,5}$/.test(depth))
      node.style.setProperty("--depth", /^\d{1,5}$/.test(displayDepth) ? displayDepth : depth);
    if (/^\d{1,5}$/.test(level)) node.style.setProperty("--level", level);
    for (const attr of ["href", "src"]) {
      if (!node.hasAttribute(attr)) continue;
      const value = safeURL(node.getAttribute(attr), base, attr === "src");
      if (value) {
        if (attr === "href" && value.startsWith(originPrefix)) {
          const url = new URL(value);
          node.setAttribute(
            attr,
            url.origin === location.origin &&
              /^\/member\/[^/]+\/?$/.test(url.pathname) &&
              !url.search &&
              !url.hash
              ? url.pathname
              : value,
          );
        } else {
          node.setAttribute(attr, value);
        }
      } else node.removeAttribute(attr);
    }
    if (node.tagName === "IMG") node.loading = "lazy";
  }
  return copy;
}

// Ported from V2EX.REP show-top-replies.ts and cloneReplyElement; see third-party notices.
// Keep the source cell > table hierarchy so the normal reply layout remains authoritative.
export function cloneTopReply(reply) {
  const cloned = reply.node.cloneNode(true);
  cloned.id = `rhot_${reply.id.slice(2)}`;
  cloned.classList.add("vx-hot-reply");
  cloned.classList.remove(
    "v2p-indent",
    "v2p-reply-last",
    "v2p-reply-leaf",
    "reply-group-item",
    "nested",
  );
  for (const name of ["data-depth", "data-reply-id", "data-v2p-reply-depth"])
    cloned.removeAttribute(name);
  for (const name of ["--depth", "--level", "--tree-top", "--tree-bottom"])
    cloned.style.removeProperty(name);
  for (const child of cloned.querySelectorAll(
    ".cell,.nested,.reply-toggle,.reply-tree-line,.reply-tree-join,.reply-tree-more",
  ))
    if (!child.closest(".reply_content")) child.remove();
  const floor = cloned.querySelector(".no");
  if (floor) {
    const jump = element("a", floor.textContent, "no");
    jump.href = `#${reply.id}`;
    jump.addEventListener("click", (event) => {
      event.preventDefault();
      reply.node.scrollIntoView({ block: "start" });
    });
    floor.replaceWith(jump);
  }
  bindClonedReplyActions(cloned, reply);
  for (const button of cloned.querySelectorAll(".v2p-reply-content > .v2p-expand-btn"))
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const content = button.parentElement;
      const collapsed = content.classList.toggle("v2p-collapsed");
      button.textContent = t(collapsed ? "expandReply" : "collapseReply");
      button.setAttribute("aria-expanded", String(!collapsed));
    });
  for (const node of cloned.querySelectorAll("[id]")) node.removeAttribute("id");
  return cloned;
}
export function initReplies({ options, getDocument, enhance, batch = (work) => work() }) {
  if (!/^\/t\/\d+\/?$/.test(location.pathname)) return null;
  const first = document.querySelector(`#Main ${REPLY}`);
  if (!first) return null;
  const container = first.parentElement,
    replies = new Map(),
    pages = new Map(),
    inFlight = new Map();
  const requested = Number(new URL(location.href).searchParams.get("p"));
  const current =
    Number.isInteger(requested) && requested >= 1 && requested <= 100_000 ? requested : 1;
  let total = Math.max(current, pageCount(document, location.pathname)),
    signature = "",
    panel,
    hotGap,
    error;
  const toolbar = owned(element("div", undefined, "cell"));
  toolbar.dataset.vxPaging = "";
  const status = element("span");
  status.setAttribute("role", "status");
  const retry = button(t("retry"), () => {
    if (error) void paging.navigate(error.page);
  });
  toolbar.append(status, retry);
  const firstMarker = owned(element("span", undefined, "vx-page-start"));
  firstMarker.dataset.vxPageStart = String(current);
  first.before(firstMarker);
  pages.set(current, firstMarker);
  const paging = createPagination({ container, first, toolbar, pages, current, total, loadPage });
  const topClones = new Map();
  const hotLimit = normalizeHotRepliesLimit(options.hotRepliesLimit);

  function render() {
    toolbar.hidden = !inFlight.size && !error;
    status.textContent = inFlight.size
      ? `${t("loadingPage", inFlight.keys().next().value)} `
      : error
        ? `${t("pageFailed", error.page, error.message)} `
        : "";
    retry.hidden = !error;
    retry.disabled = !!error && inFlight.has(error.page);
    paging.refresh(total, [...inFlight.keys()]);
    if (!options.hotReplies) return;
    const ranked = rankReplies(
      [...replies.values()].filter(
        ({ node }) =>
          !node.hidden &&
          node.style.display !== "none" &&
          !node.classList.contains("v2p-blocked-reply") &&
          !node.classList.contains("vx-content-filtered"),
      ),
      hotLimit,
    );
    const key = ranked.map((reply) => `${reply.id}:${reply.thanks}`).join("|");
    if (key === signature && panel && !ranked.some(({ id }) => topClones.get(id)?.dirty)) return;
    signature = key;
    if (!ranked.length) {
      hotGap?.remove();
      panel?.remove();
      panel = null;
      topClones.clear();
      return;
    }
    if (!panel) {
      panel = owned(element("div", undefined, "box"));
      panel.id = "top_replies";
      const header = element("div", undefined, "cell");
      header.title = t("hotRepliesHelp");
      header.append(element("div", undefined, "fr"), element("span", t("hotReplies"), "fade"));
      panel.append(header);
      hotGap = owned(element("div", undefined, "sep20"));
      hotGap.dataset.vxHotGap = "";
      const anchor =
        container.closest("#topic-replies") ?? (container.id === "Main" ? firstMarker : container);
      anchor.before(panel, hotGap);
    }
    const rankedIds = new Set(ranked.map((reply) => reply.id));
    for (const [id, cloned] of topClones) {
      if (rankedIds.has(id)) continue;
      cloned.node.remove();
      topClones.delete(id);
    }
    let previous = panel.firstElementChild;
    for (const reply of ranked) {
      let cloned = topClones.get(reply.id);
      if (!cloned || cloned.thanks !== reply.thanks || cloned.dirty) {
        const node = cloneTopReply(reply);
        cloned?.node.replaceWith(node);
        cloned = { node, thanks: reply.thanks };
        topClones.set(reply.id, cloned);
      }
      if (previous.nextElementSibling !== cloned.node) previous.after(cloned.node);
      previous = cloned.node;
    }
  }
  function add(root) {
    let changed = false;
    for (const node of matching(root, REPLY)) {
      if (!node.closest("#Main") || replies.get(node.id)?.node.isConnected) continue;
      const reply = parseReply(node);
      if (!reply) continue;
      replies.set(reply.id, reply);
      const cloned = topClones.get(reply.id);
      if (cloned) cloned.dirty = true;
      changed = true;
    }
    if (changed) render();
  }
  function loadPage(page, options) {
    const lowPriority = Boolean(options?.lowPriority);
    if (!Number.isInteger(page) || page < 1 || page > total) return Promise.resolve(false);
    if (pages.has(page)) return Promise.resolve(true);
    if (inFlight.has(page)) return inFlight.get(page);
    if (error?.page === page) error = null;
    const task = Promise.resolve()
      .then(async () => {
        try {
          const url = new URL(location.href);
          url.search = "";
          url.searchParams.set("p", String(page));
          url.hash = "";
          const doc = await getDocument(url.href, { lowPriority });
          const rows = [...doc.querySelectorAll(`#Main ${REPLY}`)];
          if (!rows.length) throw new Error(t("noReplies"));
          total = Math.max(total, pageCount(doc, location.pathname));
          const fragment = document.createDocumentFragment(),
            added = [];
          const marker = owned(element("span", undefined, "vx-page-start"));
          marker.dataset.vxPageStart = String(page);
          fragment.append(marker);
          for (const row of rows) {
            if (replies.has(row.id)) continue;
            const clean = importReply(row, url.href);
            for (const child of [...clean.querySelectorAll(REPLY)])
              if (replies.has(child.id)) child.remove();
            for (const node of matching(clean, REPLY)) {
              const reply = parseReply(node);
              if (reply) replies.set(reply.id, reply);
            }
            clean.dataset.vxLoaded = "";
            fragment.append(clean);
            added.push(clean);
          }
          const next =
            [...pages].sort(([a], [b]) => a - b).find(([number]) => number > page)?.[1] ?? toolbar;
          batch(() => {
            next.before(fragment);
            pages.set(page, marker);
            for (const row of added) enhance(row);
          });
          return true;
        } catch (failure) {
          error = { page, message: failure.message };
          return false;
        }
      })
      .finally(() => {
        inFlight.delete(page);
        batch(render);
      });
    inFlight.set(page, task);
    batch(render);
    return task;
  }
  add(container);
  render();
  return {
    add,
    replies,
    paging,
    get loaded() {
      return new Set(pages.keys());
    },
    invalidate(node) {
      const cloned = topClones.get(node.id);
      if (cloned) cloned.dirty = true;
    },
    update(nodes) {
      let changed = false;
      for (const node of nodes) {
        const reply = replies.get(node.id);
        if (reply?.node !== node) continue;
        if (!node.isConnected || !node.closest("#Main")) replies.delete(node.id);
        else {
          enhanceReplyActions(node);
          reply.thanks = thanksCount(node);
        }
        changed = true;
      }
      if (changed) render();
    },
    async preload() {
      for (let page = current + 1; page <= Math.min(total, current + options.preloadPages); page++)
        if (!(await loadPage(page, { lowPriority: true }))) break;
    },
  };
}
