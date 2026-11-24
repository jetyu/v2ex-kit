function unwrap(node) {
  return node?.wrappedJSObject ?? node;
}

function isCodeMirror(candidate) {
  return Boolean(
    candidate &&
    typeof candidate.getValue === "function" &&
    typeof candidate.setValue === "function" &&
    typeof candidate.replaceSelection === "function",
  );
}

export function findCodeMirrorElement(textarea) {
  if (!textarea) return null;
  const doc = textarea.ownerDocument;
  if (textarea.nextElementSibling?.classList?.contains("CodeMirror"))
    return textarea.nextElementSibling;
  return (
    textarea.form?.querySelector?.(".CodeMirror") ??
    textarea.closest?.("#Main, #Wrapper, body")?.querySelector?.(".CodeMirror") ??
    doc?.querySelector?.(".CodeMirror") ??
    null
  );
}

export function resolveCodeMirror(textarea, pageWindow = globalThis.unsafeWindow) {
  const doc = textarea?.ownerDocument;
  if (!doc) return null;
  const element = findCodeMirrorElement(textarea);
  const direct = unwrap(element)?.CodeMirror;
  if (isCodeMirror(direct)) return { cm: direct, element };

  const pageDoc = pageWindow?.document;
  if (pageDoc && element) {
    const all = [...doc.querySelectorAll(".CodeMirror")];
    const index = all.indexOf(element);
    const pageElement = index >= 0 ? pageDoc.querySelectorAll(".CodeMirror")[index] : null;
    const pageInstance = unwrap(pageElement)?.CodeMirror;
    if (isCodeMirror(pageInstance)) return { cm: pageInstance, element };
  }

  const globalEditor = unwrap(pageWindow)?.editor;
  if (isCodeMirror(globalEditor)) {
    const cmCount = doc.querySelectorAll(".CodeMirror").length;
    if (cmCount <= 1 && (element || textarea.form?.action?.includes("/write")))
      return { cm: globalEditor, element };
  }
  return null;
}

export function replaceTextareaRange(textarea, marker, replacement) {
  const offset = textarea.value.indexOf(marker);
  if (offset < 0) return false;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.setRangeText(replacement, offset, offset + marker.length, "preserve");
  const adjust = (position) =>
    position <= offset
      ? position
      : position >= offset + marker.length
        ? position + replacement.length - marker.length
        : offset + replacement.length;
  textarea.setSelectionRange(adjust(start), adjust(end));
  textarea.dispatchEvent(new textarea.ownerDocument.defaultView.Event("input", { bubbles: true }));
  return true;
}

export function createEditor(textarea, pageWindow = globalThis.unsafeWindow) {
  const doc = textarea.ownerDocument;
  const view = doc.defaultView;

  function syncTextarea(cm, value = cm.getValue()) {
    try {
      cm.save?.();
    } catch {
      /* Standalone CodeMirror instances may not implement save(). */
    }
    if (textarea.value !== value) {
      textarea.value = value;
      textarea.dispatchEvent(new view.Event("input", { bubbles: true }));
    }
  }

  return {
    textarea,
    getCodeMirror: () => resolveCodeMirror(textarea, pageWindow),
    getValue() {
      const resolved = resolveCodeMirror(textarea, pageWindow);
      return resolved ? resolved.cm.getValue() : textarea.value;
    },
    setValue(value) {
      const resolved = resolveCodeMirror(textarea, pageWindow);
      if (resolved) {
        resolved.cm.setValue(value);
        syncTextarea(resolved.cm, value);
        return;
      }
      textarea.value = value;
      textarea.dispatchEvent(new view.Event("input", { bubbles: true }));
    },
    insert(text, selection) {
      const resolved = resolveCodeMirror(textarea, pageWindow);
      if (resolved) {
        resolved.cm.replaceSelection(text, "end");
        syncTextarea(resolved.cm);
        resolved.cm.focus?.();
        return;
      }
      const range = selection ?? [textarea.selectionStart, textarea.selectionEnd];
      textarea.setRangeText(text, ...range, "end");
      textarea.dispatchEvent(new view.Event("input", { bubbles: true }));
      textarea.focus();
    },
    replaceMarker(marker, replacement) {
      const resolved = resolveCodeMirror(textarea, pageWindow);
      if (!resolved) return replaceTextareaRange(textarea, marker, replacement);
      const { cm } = resolved;
      const value = cm.getValue();
      const offset = value.indexOf(marker);
      if (offset < 0) return false;
      if (typeof cm.posFromIndex === "function" && typeof cm.replaceRange === "function") {
        cm.replaceRange(
          replacement,
          cm.posFromIndex(offset),
          cm.posFromIndex(offset + marker.length),
        );
      } else {
        cm.setValue(value.slice(0, offset) + replacement + value.slice(offset + marker.length));
      }
      syncTextarea(cm);
      return true;
    },
    focus() {
      const resolved = resolveCodeMirror(textarea, pageWindow);
      if (resolved) resolved.cm.focus?.();
      else textarea.focus();
    },
    onEditorSurface(bind) {
      const bound = new WeakSet();
      const attach = () => {
        if (!bound.has(textarea)) {
          bound.add(textarea);
          bind(textarea, false);
        }
        const cmElement = findCodeMirrorElement(textarea);
        if (cmElement && !bound.has(cmElement)) {
          bound.add(cmElement);
          bind(cmElement, true);
          return true;
        }
        return false;
      };
      if (attach() || !view?.MutationObserver) return () => {};
      const host = textarea.form ?? doc.body;
      if (!host) return () => {};
      const observer = new view.MutationObserver(() => {
        if (attach()) observer.disconnect();
      });
      observer.observe(host, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
  };
}
