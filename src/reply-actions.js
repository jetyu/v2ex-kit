import { t } from "./i18n.js";
import { element, matching, memberName, owned } from "./dom.js";
import { icon } from "./icons.js";

export const REPLY = '.cell[id^="r_"]';

const importedActions = new WeakMap();
const boundActions = new WeakSet();

export function captureImportedActions(root, base) {
  const anchors = root.querySelectorAll("a[onclick]");
  if (!anchors.length) return;
  const baseUrl = new URL(base);
  baseUrl.hash = "";
  const baseHref = baseUrl.href;
  const authors = new Map();
  for (const anchor of anchors) {
    if (anchor.closest(".reply_content")) continue;
    const row = anchor.closest(REPLY);
    const id = Number(/^r_(\d+)$/.exec(row?.id ?? "")?.[1]);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    let name = authors.get(row);
    if (name === undefined) {
      const author = [...row.querySelectorAll('strong a[href^="/member/"]')].find(
        (link) => link.closest(REPLY) === row,
      );
      name = memberName(author);
      authors.set(row, name);
    }
    if (!name) continue;
    const source = anchor.getAttribute("onclick") ?? "";
    let kind;
    if (Number(/\bthankReply\(\s*(\d+)\s*\)/.exec(source)?.[1]) === id) kind = "thank";
    else if (Number(/\bignoreReply\(\s*(\d+)\s*,/.exec(source)?.[1]) === id) kind = "hide";
    else {
      const match = /\breplyOne\(\s*(['"])([a-z0-9_-]{1,64})\1\s*,\s*(\d+)\s*\)/i.exec(source);
      if (match && match[2].toLowerCase() === name.toLowerCase() && Number(match[3]) === id)
        kind = "reply";
    }
    if (!kind) continue;
    if (kind !== "reply" && anchor.closest(".thank_area")?.closest(REPLY) !== row) continue;
    const cost = /(?:Spend|\u82b1\u8d39)\s*(\d+)/i.exec(source)?.[1];
    anchor.href = `${baseHref}#${row.id}`;
    importedActions.set(anchor, { kind, id, name, cost });
  }
}

function bindImportedAction(anchor, action, pageWindow) {
  if (boundActions.has(anchor)) return;
  boundActions.add(anchor);
  let pending = false;
  anchor.addEventListener("click", async (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    const method = { thank: "thankReply", hide: "ignoreReply", reply: "replyOne" }[action.kind];
    if (typeof pageWindow?.[method] !== "function") return;
    event.preventDefault();
    if (
      pending ||
      (anchor.closest(".thank_area")?.classList.contains("thanked") && action.kind === "thank")
    )
      return;
    if (action.kind !== "reply") {
      const prompt =
        action.kind === "hide"
          ? t("confirmHide")
          : action.cost
            ? t("confirmThank", action.cost, action.name)
            : t("confirmThankUnknown", action.name);
      if (!window.confirm(prompt)) return;
    }
    pending = true;
    try {
      if (action.kind === "hide") {
        const fresh =
          typeof pageWindow.fetchOnce === "function"
            ? await pageWindow.fetchOnce({ fresh: true })
            : pageWindow.once;
        const token = /^\d+$/.test(String(fresh ?? ""))
          ? String(fresh)
          : String(pageWindow.once ?? "");
        if (!/^\d+$/.test(token)) throw new Error(t("accountChanged"));
        await pageWindow.ignoreReply(action.id, token);
      } else if (action.kind === "thank") {
        const result = pageWindow.thankReply(action.id);
        // shortcut: native thankReply can return before its request; allow retries after a short cooldown.
        await (result ?? new Promise((resolve) => setTimeout(resolve, 1500)));
      } else await pageWindow.replyOne(action.name, action.id);
    } catch {
      window.alert(t("actionFailed"));
    } finally {
      pending = false;
    }
  });
}

const controlIcons = { hide: "eye-off", thank: "heart", reply: "reply" };
const controlLabels = { hide: "hideReply", thank: "thankReply", reply: "replyAction" };

function decorateAction(anchor, action) {
  if (anchor.querySelector(".v2p-control")) return;
  const control = owned(
    element("span", undefined, `v2p-control v2p-hover-btn v2p-control-${action}`),
  );
  control.append(icon(controlIcons[action]));
  anchor.classList.remove("thank");
  anchor.style.removeProperty("color");
  anchor.title = t(controlLabels[action]);
  anchor.setAttribute("aria-label", anchor.title);
  anchor.replaceChildren(control);
}

export function enhanceReplyActions(root, pageWindow = globalThis.unsafeWindow) {
  for (const anchor of matching(root, 'a[href*="#r_"], a[onclick*="replyOne"]')) {
    const action = importedActions.get(anchor);
    if (action) bindImportedAction(anchor, action, pageWindow);
    if (
      (action?.kind === "reply" || /\breplyOne\s*\(/.test(anchor.getAttribute("onclick") ?? "")) &&
      anchor.closest(REPLY)?.closest("#Main") &&
      !anchor.closest(".reply_content")
    )
      decorateAction(anchor, "reply");
  }
  for (const area of matching(root, ".thank_area")) {
    const reply = area.closest(REPLY);
    if (!reply?.closest("#Main")) continue;
    area.classList.add("v2p-controls");
    for (const node of [...area.childNodes]) if (node.nodeType === 3) node.remove();
    for (const anchor of area.querySelectorAll("a")) {
      const source = `${anchor.getAttribute("href") ?? ""} ${anchor.getAttribute("onclick") ?? ""}`;
      const action =
        importedActions.get(anchor)?.kind ??
        (/ignoreReply\s*\(|\/ignore\/reply\//.test(source)
          ? "hide"
          : /thankReply\s*\(|\/thank\/reply\//.test(source)
            ? "thank"
            : null);
      if (action) decorateAction(anchor, action);
    }
    const thankControls = [...area.querySelectorAll(".v2p-control-thank")];
    if (area.classList.contains("thanked")) {
      for (const control of thankControls) (control.closest("a") ?? control).remove();
    } else {
      for (const control of thankControls.slice(1)) (control.closest("a") ?? control).remove();
    }
    if (area.classList.contains("thanked"))
      for (const likes of reply.querySelectorAll(".v2p-likes-box"))
        if (likes.closest(REPLY) === reply) likes.classList.add("v2p-thanked");
  }
  for (const image of matching(root, 'img[alt="\u2764\uFE0F"], img[src*="/heart.png"]')) {
    const reply = image.closest(REPLY);
    if (!reply?.closest("#Main") || image.closest(".reply_content")) continue;
    const likes = image.closest(".small.fade");
    if (!likes) continue;
    likes.classList.add("v2p-likes-box");
    if (
      [...reply.querySelectorAll(".thank_area.thanked")].some(
        (area) => area.closest(REPLY) === reply,
      )
    )
      likes.classList.add("v2p-thanked");
    const heart = owned(element("span", undefined, "v2p-icon-heart"));
    heart.append(icon("heart"));
    image.replaceWith(heart);
  }
}
