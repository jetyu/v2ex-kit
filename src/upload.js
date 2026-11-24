import { t } from "./i18n.js";
import { button, element, onEditorActions, owned, replyActions, safeURL } from "./dom.js";
import { createEditor, replaceTextareaRange } from "./editor.js";
import { DEFAULT_IMGUR_CLIENT_ID, UPLOAD_PROVIDERS } from "./storage.js";
import { originalImageURL } from "./imgur-proxy.js";

export function replacePlaceholder(textarea, marker, replacement) {
  return replaceTextareaRange(textarea, marker, replacement);
}

function uploadFileError(file) {
  if (
    !/^image\/(png|jpeg|gif|webp)$/.test(file?.type) ||
    file.size > 10 * 1024 * 1024 ||
    file.size === 0
  )
    return new Error(t("imageFormat"));
  return null;
}

function imageHostURL(value, hostname) {
  const link = safeURL(value, `https://${hostname}/`, true);
  return link && new URL(link).hostname === hostname ? link : null;
}

function uploadedImageProvider(value) {
  for (const [provider, hostname] of [
    ["imgur", "i.imgur.com"],
    ["imgbb", "i.ibb.co"],
    ["catbox", "files.catbox.moe"],
  ]) {
    const link = imageHostURL(value, hostname);
    if (link) return { provider, link };
  }
  return null;
}

function deletionURL(record, provider) {
  if (provider === "imgur" && /^[a-z0-9]+$/i.test(record.deleteHash ?? ""))
    return `https://imgur.com/delete/${record.deleteHash}`;
  if (provider === "imgbb") return imageHostURL(record.deleteURL, "ibb.co");
  return null;
}

function rateLimitError(response, message) {
  const retry = /^retry-after:\s*(.+)$/im.exec(response.responseHeaders ?? "")?.[1]?.trim();
  const delay = Number(retry) > 0 ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
  const error = new Error(message);
  error.rateLimited = true;
  error.retryAt = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 3_600_000);
  return error;
}

export function uploadImage(file, request = GM_xmlhttpRequest) {
  const fileError = uploadFileError(file);
  if (fileError) return Promise.reject(fileError);
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append("image", file);
    request({
      method: "POST",
      url: "https://api.imgur.com/3/image",
      headers: { Authorization: `Client-ID ${DEFAULT_IMGUR_CLIENT_ID}` },
      data,
      anonymous: true,
      timeout: 30_000,
      onload(response) {
        try {
          if (
            response.status === 429 ||
            (response.status === 403 && /rate.?limit|quota|credits/i.test(response.responseText))
          ) {
            throw rateLimitError(response, t("imgurRateLimit"));
          }
          let body;
          try {
            body = JSON.parse(response.responseText);
          } catch {
            throw new Error(t("imgurResponse"));
          }
          const link = safeURL(body.data?.link, "https://i.imgur.com", true);
          if (
            response.status < 200 ||
            response.status >= 300 ||
            body.success !== true ||
            !link ||
            new URL(link).hostname !== "i.imgur.com"
          ) {
            throw new Error(t("imgurHTTP", response.status));
          }
          resolve({
            link,
            deleteHash: /^[a-z0-9]+$/i.test(body.data?.deletehash ?? "")
              ? body.data.deletehash
              : null,
          });
        } catch (error) {
          reject(error);
        }
      },
      onerror: () => reject(new Error(t("imgurNetwork"))),
      ontimeout: () => reject(new Error(t("imgurTimeout"))),
      onabort: () => reject(new Error(t("imgurAborted"))),
    });
  });
}

function uploadCatboxImage(file, request) {
  const fileError = uploadFileError(file);
  if (fileError) return Promise.reject(fileError);
  const label = t("uploadProvider_catbox");
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append("reqtype", "fileupload");
    data.append("fileToUpload", file);
    request({
      method: "POST",
      url: "https://catbox.moe/user/api.php",
      data,
      anonymous: true,
      timeout: 30_000,
      onload(response) {
        try {
          if (response.status === 429)
            throw rateLimitError(response, t("imageHostRateLimit", label));
          if (response.status < 200 || response.status >= 300)
            throw new Error(t("imageHostHTTP", label, response.status));
          const link = imageHostURL(response.responseText?.trim(), "files.catbox.moe");
          if (!link) throw new Error(t("imageHostResponse", label));
          resolve({ provider: "catbox", link });
        } catch (error) {
          reject(error);
        }
      },
      onerror: () => reject(new Error(t("imageHostNetwork", label))),
      ontimeout: () => reject(new Error(t("imageHostTimeout", label))),
      onabort: () => reject(new Error(t("imageHostAborted", label))),
    });
  });
}

export function uploadToProvider(file, options = {}, request = GM_xmlhttpRequest) {
  const provider = UPLOAD_PROVIDERS.includes(options.uploadProvider)
    ? options.uploadProvider
    : "imgur";
  if (provider === "imgur")
    return uploadImage(file, request).then((result) => ({
      provider,
      ...result,
    }));
  return uploadCatboxImage(file, request);
}

function sourceTopicURL(value) {
  const href = safeURL(value, location.href, true);
  if (!href) return null;
  const url = new URL(href);
  if (!/(^|\.)v2ex\.com$/i.test(url.hostname) || !/^\/t\/\d+\/?$/.test(url.pathname)) return null;
  return url.origin + url.pathname.replace(/\/$/, "");
}

export function createUploadHistory(store, focusFallback) {
  const content = element("div", undefined, "v2p-topic-preview vx-upload-history-list");
  const records = store.uploads();
  const status = element("p", undefined, "vx-upload-history-status");
  status.setAttribute("role", "status");
  const empty = element("p", t("noUploads"));
  empty.hidden = records.length > 0;
  content.append(status, empty);
  function removeRecord(record, row, message) {
    if (!row.isConnected) return;
    try {
      store.removeUpload(record.id);
    } catch {
      status.textContent = t("removeUploadFailed");
      return;
    }
    const restoreFocus = row.contains(document.activeElement);
    const nextFocus =
      row.nextElementSibling?.querySelector(".vx-upload-remove") ??
      row.previousElementSibling?.querySelector(".vx-upload-remove");
    row.remove();
    empty.hidden = !!content.querySelector(".vx-upload-record");
    status.textContent = t(message);
    if (restoreFocus) (nextFocus ?? focusFallback)?.focus();
  }
  const maxChecks = 4;
  let activeChecks = 0;
  const checkQueue = [];
  function scheduleCheck(task) {
    checkQueue.push(task);
    drainChecks();
  }
  function drainChecks() {
    while (activeChecks < maxChecks && checkQueue.length) {
      const next = checkQueue.shift();
      activeChecks++;
      Promise.resolve()
        .then(next)
        .finally(() => {
          activeChecks--;
          drainChecks();
        });
    }
  }
  for (const record of records) {
    const row = element("div", undefined, "cell vx-upload-record");
    const details = element("div", undefined, "vx-upload-record-details");
    details.append(element("p", `${record.createdAt} · ${record.fileName}`));
    const uploaded = uploadedImageProvider(record.link);
    if (uploaded) {
      const { provider, link: url } = uploaded;
      details.firstElementChild.append(` 路 ${t(`uploadProvider_${provider}`)}`);
      const link = element("a", url);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const preview = link.cloneNode(false);
      preview.className = "vx-upload-record-preview";
      const image = element("img");
      image.alt = record.fileName || t("preview");
      image.setAttribute("loading", "lazy");
      image.setAttribute("decoding", "async");
      image.setAttribute("referrerpolicy", "no-referrer");
      const thumbnail = new URL(url);
      if (provider === "imgur")
        thumbnail.pathname = thumbnail.pathname.replace(
          /^\/([a-z0-9]+)\.(jpe?g|png|gif|webp)$/i,
          "/$1m.$2",
        );
      image.addEventListener("error", () => {
        if (provider !== "imgur" || originalImageURL(image.src) === url) preview.remove();
        else image.src = url;
      });
      if (provider === "imgur" && record.id) {
        image.addEventListener(
          "load",
          () =>
            scheduleCheck(async () => {
              if (!row.isConnected) return;
              try {
                const result = await fetch(url, {
                  method: "HEAD",
                  credentials: "omit",
                  cache: "no-store",
                  referrerPolicy: "no-referrer",
                  signal: AbortSignal.timeout(5000),
                });
                if (result.redirected && result.url === "https://i.imgur.com/removed.png")
                  removeRecord(record, row, "imgurUploadRemoved");
              } catch {
                // A failed request does not confirm deletion.
              }
            }),
          { once: true },
        );
      }
      image.src = thumbnail.href;
      preview.append(image);
      row.append(preview);
      details.append(link);
    }
    const deleteLink = uploaded && deletionURL(record, uploaded.provider);
    if (deleteLink) {
      const link = element("a", t("deleteImage"));
      link.href = deleteLink;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      details.append(" · ", link);
    }
    const source = sourceTopicURL(record.sourceTopic?.url);
    if (source) {
      const context = element("p");
      const title = record.sourceTopic.title;
      const link = element("a", typeof title === "string" && title.trim() ? title : source);
      link.href = source;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      context.append(element("strong", t("sourceTopic")), " ", link);
      details.append(context);
    }
    if (record.id) {
      const remove = button(t("removeUploadRecord"), () => {
        if (window.confirm(t("confirmRemoveUpload"))) removeRecord(record, row, "uploadRemoved");
      });
      remove.classList.add("vx-upload-remove");
      details.append(remove);
    }
    row.append(details);
    content.append(row);
  }
  return content;
}

export function initUpload(options, store, request = GM_xmlhttpRequest) {
  const textarea = document.querySelector(
    'textarea#reply_content, #reply-box textarea:not(.CodeMirror textarea), textarea[name="content"]:not(.CodeMirror textarea), textarea#topic_content',
  );
  if (!textarea || !options.upload) return;
  const sourceURL = sourceTopicURL(location.href);
  const sourceTopic = sourceURL
    ? {
        title:
          document.querySelector("#Main .header h1")?.textContent.trim() || document.title.trim(),
        url: sourceURL,
      }
    : null;
  const toolbar = owned(element("div", undefined, "vx-upload"));
  const input = element("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/gif,image/webp";
  input.multiple = true;
  Object.assign(input.style, {
    visibility: "hidden",
    position: "absolute",
    top: "0",
    left: "0",
    width: "0",
    height: "0",
  });
  const messages = element("div");
  messages.setAttribute("aria-live", "polite");
  const pick = owned(button(t("replyImage"), () => input.click()));
  pick.classList.add("vr_upload_image", "vx-upload-button", "vx-editor-action-button");
  pick.setAttribute("aria-label", t("insertImage"));
  pick.title = t("insertImage");
  const editor = createEditor(textarea);
  const actions = replyActions(textarea);
  const bindSubmitGuard = (control) => {
    control?.addEventListener(
      "click",
      (event) => {
        if (pending || /\[vx-upload:[^\]]+\]/.test(editor.getValue())) {
          event.preventDefault();
          event.stopImmediatePropagation();
          messages.append(element("p", t("finishUploads")));
        }
      },
      true,
    );
  };
  if (actions) {
    actions.append(pick);
    bindSubmitGuard(actions.submit);
  } else {
    textarea.form?.append(pick);
    onEditorActions(textarea, (ready) => {
      ready.append(pick);
      bindSubmitGuard(ready.submit);
    });
  }
  toolbar.append(input, messages);
  const anchor = editor.getCodeMirror()
    ? (actions?.root ?? editor.getCodeMirror().element)
    : textarea;
  anchor.after(toolbar);
  let queue = Promise.resolve();
  let pending = 0;
  const provider = UPLOAD_PROVIDERS.includes(options.uploadProvider)
    ? options.uploadProvider
    : "imgur";
  const pauseKey = provider === "imgur" ? "upload-paused-until" : `upload-paused-until:${provider}`;
  let pausedUntil = store.get(pauseKey, 0);
  const paused = () => Math.max(pausedUntil, store.get(pauseKey, 0)) > Date.now();

  function enqueue(files) {
    const images = [...files].filter((file) => file.type.startsWith("image/"));
    if (!images.length) return false;
    if (paused()) {
      messages.textContent = t("uploadPaused");
      return false;
    }
    if (images.length + pending > 10) {
      messages.textContent = t("queueLimit");
      return false;
    }
    for (const file of images) {
      pending++;
      const marker = `[vx-upload:${crypto.randomUUID()}]`;
      editor.insert(`\n${marker}\n`);
      const row = element("p", t("queued", file.name || t("pastedImage")));
      messages.append(row);
      while (messages.children.length > 20) messages.firstElementChild.remove();
      queue = queue.then(async () => {
        if (paused()) {
          editor.replaceMarker(marker, "");
          row.textContent = t("cancelQueued");
          pending--;
          return;
        }
        row.textContent = t("uploading", file.name || t("pastedImage"));
        try {
          const result = await uploadToProvider(file, options, request);
          const replaced = editor.replaceMarker(marker, result.link);
          row.textContent = replaced ? t("uploaded") : t("draftMarkerRemoved");
          const link = element("a", result.link);
          link.href = result.link;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          row.append(link);
          const deleteLink = deletionURL(result, result.provider);
          if (deleteLink) {
            const deletion = element("a", ` ${t("saveDelete")}`);
            deletion.href = deleteLink;
            deletion.target = "_blank";
            deletion.rel = "noopener noreferrer";
            row.append(deletion);
          }
          try {
            const record = { ...result, fileName: file.name || t("pastedImage") };
            if (sourceTopic) record.sourceTopic = sourceTopic;
            store.recordUpload(record);
          } catch {
            row.append(` ${t("uploadRecordFailed")}`);
          }
        } catch (error) {
          if (error.rateLimited) {
            pausedUntil = error.retryAt;
            try {
              store.set(pauseKey, error.retryAt);
            } catch {
              /* Keep this page paused even when storage is full. */
            }
          }
          editor.replaceMarker(marker, "");
          row.textContent = `${file.name || t("pastedImage")}: ${error.message}${error.rateLimited ? "" : ` ${t("selectAgain")}`}`;
        } finally {
          pending--;
        }
      });
    }
    return true;
  }

  input.addEventListener("change", () => {
    enqueue(input.files);
    input.value = "";
  });
  const handledEvents = new WeakSet();
  editor.onEditorSurface((target, capture) => {
    target.addEventListener(
      "paste",
      (event) => {
        if (handledEvents.has(event)) return;
        const images = [...(event.clipboardData?.items ?? [])]
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile())
          .filter(Boolean);
        if (enqueue(images)) {
          handledEvents.add(event);
          event.preventDefault();
          if (capture) event.stopPropagation();
        }
      },
      capture,
    );
    target.addEventListener(
      "dragover",
      (event) => {
        if ([...(event.dataTransfer?.items ?? [])].some((item) => item.type.startsWith("image/")))
          event.preventDefault();
      },
      capture,
    );
    target.addEventListener(
      "drop",
      (event) => {
        if (handledEvents.has(event)) return;
        const files = [...(event.dataTransfer?.files ?? [])];
        if (!files.some((file) => file.type.startsWith("image/"))) return;
        handledEvents.add(event);
        event.preventDefault();
        if (capture) event.stopPropagation();
        enqueue(files);
      },
      capture,
    );
  });
  textarea.form?.addEventListener(
    "submit",
    (event) => {
      if (pending || /\[vx-upload:[^\]]+\]/.test(editor.getValue())) {
        event.preventDefault();
        event.stopImmediatePropagation();
        messages.append(element("p", t("finishUploads")));
      }
    },
    true,
  );
}
