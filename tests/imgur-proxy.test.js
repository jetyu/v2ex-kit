import assert from "node:assert/strict";
import test from "node:test";
import { installImgurProxy, originalImageURL } from "../src/imgur-proxy.js";
import { dom } from "./helpers.js";
import { normalizeOptions } from "../src/storage.js";

test("Imgur proxy handles existing images, inserted subtrees and updated sources", async () => {
  dom('<img id="existing" src="https://i.imgur.com/example.png?a=1&b=2#image">');
  const existing = document.querySelector("#existing");
  const original = existing.src;
  installImgurProxy(document);
  const proxied = new URL(existing.src);
  assert.equal(proxied.origin, "https://proxy.duckduckgo.com");
  assert.equal(proxied.searchParams.get("u"), original);
  assert.equal(originalImageURL(existing.src), original);

  document.body.insertAdjacentHTML(
    "beforeend",
    '<div><a href="https://imgur.com/example"><img id="added" src="https://imgur.com/a.png"></a>' +
      '<img id="external" src="https://notimgur.com/imgur.com.png"></div>',
  );
  await Promise.resolve();
  const added = document.querySelector("#added");
  assert.equal(originalImageURL(added.src), "https://imgur.com/a.png");
  assert.notEqual(added.src, "https://imgur.com/a.png");
  assert.equal(added.closest("a").href, "https://imgur.com/example");
  assert.equal(document.querySelector("#external").src, "https://notimgur.com/imgur.com.png");

  added.src = "https://i.imgur.com/b.png";
  await Promise.resolve();
  assert.equal(originalImageURL(added.src), "https://i.imgur.com/b.png");
  assert.equal(new URL(added.src).origin, proxied.origin);
});

test("custom HTTPS proxies preserve the image URL and fall back for invalid settings", () => {
  const page = dom('<img src="https://i.imgur.com/a.png?x=1&y=2">');
  const doc = page.window.document;
  const image = doc.querySelector("img");
  const original = image.src;
  const prefix = "https://images.example.com/image?width=800&url=";
  const { imgurProxyUrl } = normalizeOptions({ imgurProxyUrl: ` ${prefix} ` });
  assert.equal(imgurProxyUrl, prefix);
  installImgurProxy(doc, imgurProxyUrl);
  assert.equal(image.src, prefix + encodeURIComponent(original));
  assert.equal(originalImageURL(image.src, doc), original);
  for (const invalid of ["", "http://example.com/?u=", "https://example.com/?x=a?u="]) {
    assert.equal(
      normalizeOptions({ imgurProxyUrl: invalid }).imgurProxyUrl,
      "https://proxy.duckduckgo.com/iu/?u=",
    );
  }
  page.window.close();
});
