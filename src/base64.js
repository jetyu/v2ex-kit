const TOKEN = /(?:^|(?<=[^A-Za-z0-9+/=_-]))([A-Za-z0-9+/]{8,}={0,2})(?=$|[^A-Za-z0-9+/=_-])/g;
const CONTENT = ".topic_content, .reply_content, .v2p-topic-reply-content";
const SKIP = "script, style, textarea, input, select, option, code, pre, [data-vx-owned]";
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const scannedText = new WeakMap();

function inspectUTF8(binary) {
  const length = binary.length;
  let asciiOnly = true;
  for (let i = 0; i < length; i++) {
    const b0 = binary.charCodeAt(i);
    if (b0 < 0x80) {
      if (b0 <= 0x08 || b0 === 0x0b || b0 === 0x0c || (b0 >= 0x0e && b0 <= 0x1f) || b0 === 0x7f)
        return 0;
      continue;
    }
    asciiOnly = false;
    if (b0 >= 0xc2 && b0 <= 0xdf) {
      if (i + 1 >= length) return 0;
      const b1 = binary.charCodeAt(++i);
      if ((b1 & 0xc0) !== 0x80) return 0;
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      if (i + 2 >= length) return 0;
      const b1 = binary.charCodeAt(++i);
      const b2 = binary.charCodeAt(++i);
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) return 0;
      if ((b0 === 0xe0 && b1 < 0xa0) || (b0 === 0xed && b1 >= 0xa0)) return 0;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      if (i + 3 >= length) return 0;
      const b1 = binary.charCodeAt(++i);
      const b2 = binary.charCodeAt(++i);
      const b3 = binary.charCodeAt(++i);
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) return 0;
      if ((b0 === 0xf0 && b1 < 0x90) || (b0 === 0xf4 && b1 >= 0x90)) return 0;
    } else {
      return 0;
    }
  }
  return asciiOnly ? 1 : 2;
}

export function decodeBase64(value) {
  if (
    value.length % 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  )
    return null;
  try {
    const binary = atob(value);
    if (binary.length < 4) return null;
    const kind = inspectUTF8(binary);
    if (!kind) return null;
    let decoded;
    if (kind === 1) {
      decoded = binary;
    } else {
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      decoded = utf8Decoder.decode(bytes);
    }
    if (!decoded.trim()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function replaceText(node) {
  const source = node.data;
  if (source.length < 8) {
    scannedText.set(node, source);
    return;
  }
  TOKEN.lastIndex = 0;
  let match;
  let offset = 0;
  let changed = false;
  let fragment;
  while ((match = TOKEN.exec(source))) {
    const encoded = match[1];
    const decoded = decodeBase64(encoded);
    if (decoded === null) continue;
    if (!fragment) fragment = node.ownerDocument.createDocumentFragment();
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
  if (!changed) {
    scannedText.set(node, source);
    return;
  }
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
      if (
        scannedText.get(node) !== node.data &&
        !node.parentElement?.closest(SKIP) &&
        node.data.trim()
      )
        nodes.push(node);
    }
    for (const node of nodes) replaceText(node);
  }
}
