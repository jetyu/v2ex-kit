import { matching } from "./dom.js";

export const DEFAULT_IMGUR_PROXY_URL = "https://proxy.duckduckgo.com/iu/?u=";
const endpoints = new WeakMap();

export function normalizeImgurProxyURL(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.href.endsWith("=") &&
      !url.hash &&
      /(?:^\?|&)[\w.-]+=$/.test(url.search)
    )
      return url.href;
  } catch {
    // An invalid URL can be corrected in settings.
  }
  return null;
}

function isImgur(url) {
  return (
    (url.protocol === "https:" || url.protocol === "http:") &&
    !url.username &&
    !url.password &&
    /(^|\.)imgur\.com$/i.test(url.hostname)
  );
}

function imgurURL(source) {
  try {
    const url = new URL(source);
    return isImgur(url) ? url : null;
  } catch {
    return null;
  }
}

export function originalImageURL(source, doc = globalThis.document) {
  const prefix = endpoints.get(doc) ?? DEFAULT_IMGUR_PROXY_URL;
  if (!source.startsWith(prefix)) return source;
  try {
    return imgurURL(decodeURIComponent(source.slice(prefix.length)))?.href ?? source;
  } catch {
    return source;
  }
}

export function installImgurProxy(doc, value) {
  const prefix = normalizeImgurProxyURL(value) ?? DEFAULT_IMGUR_PROXY_URL;
  endpoints.set(doc, prefix);
  function rewrite(image) {
    const url = imgurURL(image.src);
    if (!url || url.href.startsWith(prefix)) return;
    image.referrerPolicy = "no-referrer";
    image.src = prefix + encodeURIComponent(url.href);
  }
  const selector = "img[src]";
  const view = doc.defaultView;
  for (const image of doc.querySelectorAll(selector)) rewrite(image);
  const observer = new view.MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.target.matches(selector)) rewrite(record.target);
      } else {
        for (const node of record.addedNodes)
          if (node.nodeType === 1) for (const image of matching(node, selector)) rewrite(image);
      }
    }
  });
  observer.observe(doc, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  view.addEventListener("pagehide", (event) => {
    if (!event.persisted) observer.disconnect();
  });
}
