import { t } from "./i18n.js";
import { button, createHTTP, element, matching, modal, owned, safeContent } from "./dom.js";
import { enhanceEmojis } from "./emoji.js";
import { enhanceImages, installImageViewer } from "./image-viewer.js";

export function createTopics(options, getDocument = createHTTP()) {
  const seen = new WeakSet();
  const cache = new Map();
  function loadTopic(path) {
    const cached = cache.get(path);
    if (cached?.expires > Date.now()) return cached.promise;
    cache.delete(path);
    const base = new URL(path, location.href).href;
    const entry = {
      expires: Date.now() + 600_000,
      promise: Promise.resolve()
        .then(() => getDocument(path))
        .then((doc) => {
          const main = doc.querySelector("#Main, #Wrapper > .content");
          const title = main?.querySelector(".header h1, h1");
          if (!title) throw new Error(t("requestUnexpected"));
          const body = main.querySelector(".topic_content:not(.subtle *)");
          const supplements = [...main.querySelectorAll(".subtle")]
            .map((section) => section.querySelector(".topic_content, .markdown_body"))
            .filter(Boolean)
            .map((content) => safeContent(content, base));
          return {
            title: title.textContent.trim(),
            body: body && safeContent(body, base),
            supplements,
          };
        })
        .catch((error) => {
          if (cache.get(path) === entry) cache.delete(path);
          throw error;
        }),
    };
    if (cache.size >= 20) cache.delete(cache.keys().next().value);
    cache.set(path, entry);
    return entry.promise;
  }
  return {
    enhance(root) {
      for (const link of matching(
        root,
        ".item_title a[href], a.topic-link[href], .item_hot_topic_title > a[href], a.v2p-member-topic-item[href]",
      )) {
        if (seen.has(link)) continue;
        seen.add(link);
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin || !/^\/t\/\d+\/?$/.test(url.pathname)) continue;
        if (options.newTab) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        if (!options.preview) continue;
        const trigger = owned(
          button(t("preview"), async () => {
            const dialog = modal(link.textContent);
            const titleLink = element("a", link.textContent, "v2p-topic-preview-title-link");
            titleLink.title = link.textContent;
            titleLink.href = url.href;
            titleLink.target = options.newTab ? "_blank" : "_self";
            titleLink.rel = "noopener noreferrer";
            dialog.title.replaceChildren(titleLink);
            const original = element("a", t("openTopic"), "normal button special");
            original.href = url.href;
            original.target = options.newTab ? "_blank" : "_self";
            original.rel = "noopener noreferrer";
            dialog.actions.prepend(original);
            dialog.root.classList.add("vx-topic-excerpt");
            const body = element("div", t("previewLoading"), "v2p-topic-preview");
            body.setAttribute("aria-busy", "true");
            dialog.content.append(body);
            installImageViewer(body);
            try {
              const topic = await loadTopic(url.pathname);
              if (!dialog.root.isConnected) return;
              titleLink.textContent = titleLink.title = topic.title;
              body.replaceChildren();
              const text = element("div", undefined, "topic_content");
              text.append(topic.body?.cloneNode(true) ?? element("p", t("previewEmpty")));
              body.append(text);
              for (const supplement of topic.supplements) {
                const section = element("div", undefined, "topic_content");
                section.append(supplement.cloneNode(true));
                body.append(element("hr"), section);
              }
              enhanceEmojis(body);
              enhanceImages(body);
            } catch (error) {
              if (dialog.root.isConnected) body.textContent = error.message;
            } finally {
              body.removeAttribute("aria-busy");
            }
          }),
        );
        trigger.className = "v2p-topic-preview-btn";
        const title = link.closest(".item_title");
        if (title) {
          trigger.classList.add("vx-preview-visible");
          title.after(trigger);
        } else if (link.parentElement.matches(".v2p-member-topic-item-row")) {
          link.after(trigger);
        } else if (link.parentElement.matches(".item_hot_topic_title")) {
          link.parentElement.append(trigger);
        }
      }
    },
  };
}
