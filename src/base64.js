const TOKEN = /(?:^|(?<=[^A-Za-z0-9+/=_-]))([A-Za-z0-9+/]{8,}={0,2})(?=$|[^A-Za-z0-9+/=_-])/g;
const CONTENT = ".topic_content, .reply_content, .v2p-topic-reply-content";
const SKIP = "script, style, textarea, input, select, option, code, pre, [data-vx-owned]";

export function decodeBase64(value) {
  if (
    value.length % 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  )
    return null;
  try {
    const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    if (bytes.length < 4 || bytes.includes(0)) return null;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!decoded.trim() || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(decoded))
      return null;
    return decoded;
  } catch {
    return null;
  }
}

function replaceText(node) {
  const source = node.data;
  TOKEN.lastIndex = 0;
  let match;
  let offset = 0;
  let changed = false;
  const fragment = node.ownerDocument.createDocumentFragment();
  while ((match = TOKEN.exec(source))) {
    const encoded = match[1];
    const decoded = decodeBase64(encoded);
    if (decoded === null) continue;
    const start = match.index + match[0].indexOf(encoded);
    fragment.append(source.slice(offset, start));
    const output = node.ownerDocument.createElement("span");
    output.className = "v2p-decode";
    output.dataset.vxOwned = "";
    output.dataset.title = encoded;
    output.title = encoded;
    output.textContent = decoded;
    fragment.append(output);
    offset = start + encoded.length;
    changed = true;
  }
  if (!changed) return;
  fragment.append(source.slice(offset));
  node.replaceWith(fragment);
}

export function enhanceBase64(root) {
  const containers = [];
  if (root.nodeType === 9) containers.push(...root.querySelectorAll(CONTENT));
  else if (root.nodeType === 1) {
    if (root.matches(CONTENT)) containers.push(root);
    containers.push(...root.querySelectorAll(CONTENT));
  }
  for (const container of containers) {
    const walker = container.ownerDocument.createTreeWalker(
      container,
      container.ownerDocument.defaultView.NodeFilter.SHOW_TEXT,
    );
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest(SKIP) && node.data.trim()) nodes.push(node);
    }
    for (const node of nodes) replaceText(node);
  }
}
