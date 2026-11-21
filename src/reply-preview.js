import { element, owned, safeURL } from "./dom.js";
import { t } from "./i18n.js";

const TOKEN = /https?:\/\/[^\s<>"']+|@[a-z0-9_-]{1,64}\b|\/t\/\d+(?:#reply\d+)?/gi;
const TRAILING_PUNCTUATION = /[.,!?;:，。！？；：、）)\]}]+$/u;
const IMAGE_PATH = /\.(?:avif|gif|jpe?g|png|webp)$/i;

function link(doc, text, href) {
  const target = safeURL(href, doc.location?.href ?? location.href);
  if (!target) return doc.createTextNode(text);
  const anchor = element("a", text, undefined, doc);
  anchor.href = target;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function image(doc, text, href) {
  const target = safeURL(href, doc.location?.href ?? location.href, true);
  if (!target || !IMAGE_PATH.test(new URL(target).pathname)) return null;
  const anchor = link(doc, "", target);
  if (anchor.nodeType !== 1) return null;
  anchor.className = "v2p-lite-preview-image-link";
  const picture = element("img", undefined, "embedded_image v2p-lite-preview-image", doc);
  picture.src = target;
  picture.alt = text;
  picture.loading = "lazy";
  picture.referrerPolicy = "no-referrer";
  anchor.append(picture);
  return anchor;
}

export function renderReplyPreview(container, value) {
  const doc = container.ownerDocument;
  const text = String(value ?? "");
  container.replaceChildren();
  if (!text.trim()) {
    container.append(element("span", t("replyPreviewEmpty"), "v2p-lite-reply-preview-state", doc));
    return;
  }
  let offset = 0;
  for (const match of text.matchAll(TOKEN)) {
    container.append(doc.createTextNode(text.slice(offset, match.index)));
    let token = match[0];
    let trailing = "";
    if (/^https?:/i.test(token)) {
      trailing = TRAILING_PUNCTUATION.exec(token)?.[0] ?? "";
      if (trailing) token = token.slice(0, -trailing.length);
    }
    if (token.startsWith("@")) {
      container.append(link(doc, token, `/member/${token.slice(1)}`));
    } else if (token.startsWith("/t/")) {
      container.append(link(doc, token, token));
    } else {
      container.append(image(doc, token, token) ?? link(doc, token, token));
    }
    if (trailing) container.append(doc.createTextNode(trailing));
    offset = match.index + match[0].length;
  }
  container.append(doc.createTextNode(text.slice(offset)));
}

export function initReplyPreview(options, doc = document) {
  if (!options.replyPreview) return null;
  const textarea = doc.querySelector(
    "#reply-box textarea#reply_content, textarea#reply_content, #reply-box textarea[name=content]",
  );
  if (!textarea || textarea.dataset.vxReplyPreview !== undefined) return null;
  textarea.dataset.vxReplyPreview = "";
  if (!textarea.id) textarea.id = "vx-reply-content";

  const tabs = owned(element("div", undefined, "v2p-lite-reply-tabs", doc));
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", t("replyPreviewTitle"));
  const edit = element("button", t("edit"), "v2p-lite-reply-tab", doc);
  const preview = element("button", t("preview"), "v2p-lite-reply-tab", doc);
  for (const tab of [edit, preview]) {
    tab.type = "button";
    tab.setAttribute("role", "tab");
  }
  edit.id = `${textarea.id}-edit-tab`;
  preview.id = `${textarea.id}-preview-tab`;
  const output = owned(element("div", undefined, "v2p-lite-reply-preview v2p-reply-preview", doc));
  output.id = `${textarea.id}-preview`;
  output.setAttribute("role", "tabpanel");
  output.setAttribute("aria-labelledby", preview.id);
  output.setAttribute("aria-live", "polite");
  output.tabIndex = 0;
  edit.setAttribute("aria-controls", textarea.id);
  preview.setAttribute("aria-controls", output.id);
  textarea.setAttribute("aria-labelledby", edit.id);
  tabs.append(edit, preview);
  textarea.before(tabs);
  textarea.after(output);

  let mode = "edit";
  function activate(next, focusEditor = false) {
    mode = next;
    const editing = mode === "edit";
    if (!editing) {
      const { width, height } = textarea.getBoundingClientRect();
      if (width > 0) {
        output.style.width = `${width}px`;
        output.style.maxWidth = `${width}px`;
      }
      if (height > 0) {
        output.style.height = `${height}px`;
        output.style.minHeight = "0px";
      }
      renderReplyPreview(output, textarea.value);
    }
    textarea.hidden = !editing;
    output.hidden = editing;
    for (const [tab, selected] of [
      [edit, editing],
      [preview, !editing],
    ]) {
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    if (editing && focusEditor) textarea.focus({ preventScroll: true });
  }

  edit.addEventListener("click", () => activate("edit", true));
  preview.addEventListener("click", () => activate("preview"));
  tabs.addEventListener("keydown", (event) => {
    const current = event.target === edit ? 0 : event.target === preview ? 1 : -1;
    if (current < 0) return;
    const next = {
      ArrowLeft: 1 - current,
      ArrowRight: 1 - current,
      Home: 0,
      End: 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    [edit, preview][next].click();
    [edit, preview][next].focus();
  });
  textarea.addEventListener("input", () => {
    if (mode === "preview") renderReplyPreview(output, textarea.value);
  });
  textarea.form?.addEventListener("reset", () => {
    doc.defaultView.setTimeout(() => {
      if (mode === "preview") renderReplyPreview(output, textarea.value);
    });
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (mode === "preview" && event.target.closest?.(".vx-quick-reply")) activate("edit", false);
    },
    true,
  );
  activate("edit");
  return { tabs, edit, preview, output, textarea };
}
