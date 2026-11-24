import { t } from "./i18n.js";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import groups from "./vendor/polish/emoticons.json" with { type: "json" };
import { button, element, matching, onEditorActions, owned, replyActions } from "./dom.js";
import { createEditor } from "./editor.js";
import { originalImageURL } from "./imgur-proxy.js";

const groupLabels = {
  "\u6d41\u884c": "emojiPopular",
  "\u5c0f\u9ec4\u8138": "emojiFaces",
  "\u624b\u52bf": "emojiGestures",
  "\u5e86\u795d": "emojiCelebration",
  "\u5176\u4ed6": "emojiOther",
};

let emojiMaps;
function getEmojiMaps() {
  if (!emojiMaps) {
    const pictures = new Map();
    const tokens = new Map();
    const tokenPictures = new Map();
    const emojiSources = new Set();
    for (const group of groups) {
      for (const item of group.items) {
        if (item.url) {
          pictures.set(item.url, item.image);
          tokens.set(item.value, item.url);
          emojiSources.add(item.url);
        }
        if (item.image) {
          tokenPictures.set(item.value, item.image);
          emojiSources.add(item.image);
        }
      }
    }
    emojiMaps = { pictures, tokens, tokenPictures, emojiSources };
  }
  return emojiMaps;
}

export function emojiPicture(token) {
  return getEmojiMaps().tokenPictures.get(token) ?? null;
}

export function transformEmoji(text) {
  const { tokens } = getEmojiMaps();
  return text.replace(/\[[^\]]+\]/g, (token) =>
    tokens.has(token) ? `${tokens.get(token)} ` : token,
  );
}

export function enhanceEmojis(root) {
  const images = matching(root, "img.embedded_image");
  if (!images.length) return;
  const { pictures, emojiSources } = getEmojiMaps();
  for (const image of images) {
    const source = originalImageURL(image.getAttribute("src") ?? "", image.ownerDocument);
    const high = pictures.get(source);
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
    'textarea#reply_content, #reply-box textarea:not(.CodeMirror textarea), textarea[name="content"]:not(.CodeMirror textarea), textarea#topic_content',
  );
  if (!textarea) return;
  const actions = replyActions(textarea);
  if (!actions) {
    if (textarea.vxEmojiActionsPending) return;
    textarea.vxEmojiActionsPending = true;
    onEditorActions(textarea, () => {
      textarea.vxEmojiActionsPending = false;
      initEmoji(options, doc);
    });
    return;
  }
  if (textarea.vxEmojiInitialized) return;
  textarea.vxEmojiInitialized = true;
  const editor = createEditor(textarea);
  const trigger = owned(button(t("replyEmoji"), () => {}, doc));
  trigger.classList.add("v2p-lite-emoji-trigger", "vx-editor-action-button");
  trigger.setAttribute("aria-label", t("insertEmoji"));
  trigger.title = t("insertEmoji");
  actions.append(trigger);
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
            editor.insert(item.value, selection);
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
    editor.focus();
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
  const applyEmoji = () => {
    const value = editor.getValue();
    const transformed = transformEmoji(value);
    if (transformed === value) return;
    editor.setValue(transformed);
  };
  actions.submit.addEventListener("click", applyEmoji, true);
  textarea.form?.addEventListener(
    "submit",
    (event) => {
      if (!event.defaultPrevented) applyEmoji();
    },
    true,
  );
}
