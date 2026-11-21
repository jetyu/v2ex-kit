import { t } from "./i18n.js";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import groups from "./vendor/polish/emoticons.json" with { type: "json" };
import { button, element, matching, owned, replyActions } from "./dom.js";
import { originalImageURL } from "./imgur-proxy.js";
import { icon } from "./icons.js";

const groupLabels = {
  "\u6d41\u884c": "emojiPopular",
  "\u5c0f\u9ec4\u8138": "emojiFaces",
  "\u624b\u52bf": "emojiGestures",
  "\u5e86\u795d": "emojiCelebration",
  "\u5176\u4ed6": "emojiOther",
};

const pictures = new Map(
  groups
    .flatMap((group) => group.items)
    .filter((item) => item.url)
    .map((item) => [item.url, item.image]),
);
const tokens = new Map(
  groups
    .flatMap((group) => group.items)
    .filter((item) => item.url)
    .map((item) => [item.value, item.url]),
);
const emojiSources = new Set([...pictures.keys(), ...pictures.values()]);

export function transformEmoji(text) {
  return text.replace(/\[[^\]]+\]/g, (token) =>
    tokens.has(token) ? `${tokens.get(token)} ` : token,
  );
}

export function enhanceEmojis(root) {
  for (const image of matching(root, "img.embedded_image")) {
    const source = originalImageURL(image.getAttribute("src") ?? "", image.ownerDocument);
    const high = pictures.get(source);
    if (high) image.src = high;
    if (high || emojiSources.has(source)) {
      image.classList.add("v2p-emoji-img");
      image.style.width = "var(--v2p-emoji-size)";
      image.style.height = "var(--v2p-emoji-size)";
    }
  }
}

export function initEmoji(options, doc = document) {
  if (!options.emoji) return;
  const textarea = doc.querySelector(
    'textarea#reply_content, #reply-box textarea, textarea[name="content"]',
  );
  if (!textarea) return;
  const actions = replyActions(textarea);
  if (!actions) return;
  const trigger = owned(button("", () => {}, doc));
  trigger.classList.add("v2p-lite-emoji-trigger", "vx-editor-icon-button");
  trigger.setAttribute("aria-label", t("insertEmoji"));
  trigger.title = t("insertEmoji");
  const graphic = element("span", undefined, "vx-editor-button-icon", doc);
  graphic.append(icon("smile"));
  trigger.append(graphic);
  actions.root.append(trigger);
  const popup = owned(element("div", undefined, "v2p-popup", doc));
  popup.hidden = true;
  popup.append(element("div", undefined, "v2p-popup-content", doc));
  (doc.querySelector("#reply-box") ?? textarea.form).append(popup);
  let rendered = false,
    selection = [textarea.selectionStart, textarea.selectionEnd];
  const remember = () => {
    selection = [textarea.selectionStart, textarea.selectionEnd];
  };
  textarea.addEventListener("select", remember);
  textarea.addEventListener("keyup", remember);
  textarea.addEventListener("click", remember);
  textarea.addEventListener("input", remember);
  const close = () => {
    popup.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", () => {
    if (!popup.hidden) {
      close();
      return;
    }
    if (!rendered) {
      rendered = true;
      const container = element("div", undefined, "v2p-emoji-container", doc),
        box = element("div", undefined, "v2p-emoticons-box", doc);
      for (const group of groups) {
        const section = element("div", undefined, "v2p-emoji-group", doc),
          list = element("div", undefined, "v2p-emoji-list", doc);
        const title = groupLabels[group.title] ? t(groupLabels[group.title]) : group.title;
        section.append(element("div", title, "v2p-emoji-title", doc), list);
        for (const item of group.items) {
          const choice = element("span", item.image ? undefined : item.value, "v2p-emoji", doc);
          choice.title = item.value;
          choice.tabIndex = 0;
          choice.setAttribute("role", "button");
          choice.setAttribute("aria-label", item.value);
          if (item.image) {
            const image = doc.createElement("img");
            image.src = item.image;
            image.alt = item.value;
            image.loading = "lazy";
            choice.append(image);
          }
          const insert = () => {
            textarea.setRangeText(item.value, ...selection, "end");
            textarea.dispatchEvent(new doc.defaultView.Event("input", { bubbles: true }));
            textarea.focus();
            remember();
          };
          choice.addEventListener("click", insert);
          choice.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              insert();
            }
          });
          list.append(choice);
        }
        box.append(section);
      }
      container.append(box);
      popup.append(container);
    }
    popup.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    void computePosition(trigger, popup, {
      placement: "right-end",
      middleware: [offset({ mainAxis: 5, crossAxis: 5 }), flip(), shift({ padding: 8 })],
    })
      .then(({ x, y }) => {
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;
      })
      .catch(close);
    textarea.focus();
  });
  doc.addEventListener("click", (event) => {
    if (!popup.contains(event.target) && !trigger.contains(event.target)) close();
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && !popup.hidden) {
      event.preventDefault();
      close();
    }
  });
  textarea.form?.addEventListener(
    "submit",
    (event) => {
      if (!event.defaultPrevented) textarea.value = transformEmoji(textarea.value);
    },
    true,
  );
}
