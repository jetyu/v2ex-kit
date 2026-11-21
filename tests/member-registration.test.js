import assert from "node:assert/strict";
import test from "node:test";
import { createMemberRegistration, registrationDate } from "../src/member-registration.js";
import { createStorage } from "../src/storage.js";
import { dom, memoryAPI } from "./helpers.js";

const response = (name, created) => ({
  ok: true,
  status: 200,
  json: async () => ({ username: name, id: name.length, created }),
});
const settle = () => new Promise(setImmediate);

test("topic pages place registration dates beside the native author metadata", async () => {
  dom(`
    <div id="Main">
      <div class="box"><div class="header">
        <div class="fr"><a class="topic-avatar" href="/member/Alice"><img class="avatar" alt="Alice"></a></div>
        <h1>Topic</h1>
        <small class="gray"><a class="topic-author" href="/member/Alice">Alice</a><span class="topic-activity"> · 3 小时 29 分钟前 · 834 次点击</span></small>
      </div></div>
      <div class="box">
        <div class="cell" id="r_1"><strong><a href="/member/Alice">Alice</a></strong><div class="reply_content">OP reply</div></div>
        <div class="cell" id="r_2"><strong><a href="/member/Bob">Bob</a></strong><div class="reply_content">Reply</div></div>
        <div class="cell" id="r_3"><strong><a href="/member/Bob">Bob</a></strong><div class="reply_content">Again</div></div>
      </div>
    </div>
  `);
  const api = memoryAPI();
  const store = createStorage(api);
  const calls = [];
  const created = { alice: 1_609_459_200, bob: 1_640_995_200 };
  const registration = createMemberRegistration(
    store,
    { showMemberRegistration: true },
    async (path) => {
      const name = new URL(path, location.href).searchParams.get("username");
      calls.push(name);
      return response(name, created[name.toLowerCase()]);
    },
  );
  registration.enhance(document);
  await settle();
  await settle();
  assert.deepEqual(calls.sort(), ["Alice", "Bob"]);
  const author = document.querySelector(".topic-author");
  assert.equal(author.nextElementSibling.classList.contains("vx-topic-author-member-meta"), true);
  assert.equal(author.nextElementSibling.textContent, "注册于 2021-01-01");
  assert.equal(author.nextElementSibling.nextElementSibling.className, "topic-activity");
  assert.equal(document.querySelector(".topic-avatar").nextElementSibling, null);
  assert.equal(document.querySelector(".header > .fr .vx-member-inline-meta"), null);
  assert.equal(document.querySelector(".vx-op-badge"), null);
  assert.deepEqual(
    [...document.querySelectorAll(".vx-member-registration")].map((node) => node.textContent),
    ["注册于 2021-01-01", "注册于 2021-01-01", "注册于 2022-01-01", "注册于 2022-01-01"],
  );
  assert.equal(registrationDate(1_609_459_200), "2021-01-01");
});

test("topic lists show author dates from persistent cache without OP labels or new requests", async () => {
  dom(
    `<div id="Main">
      <div class="cell item"><span class="item_title"><a href="/t/1">One</a></span><span class="topic_info"><strong><a href="/member/Alice">Alice</a></strong><span class="latest-activity"><a href="/member/Bob">Bob</a> 3 分钟前</span></span></div>
      <div class="cell item"><span class="item_title"><a href="/t/2">Two</a></span><span class="topic_info"><strong><a href="/member/Alice">Alice</a></strong></span></div>
    </div>`,
    "https://www.v2ex.com/?tab=hot",
  );
  const api = memoryAPI();
  api.set("v2ex-lite:member-registration-cache:v1", { alice: 1_609_459_200 });
  const registration = createMemberRegistration(
    createStorage(api),
    { showMemberRegistration: true },
    () => assert.fail("cached registration dates must not be fetched again"),
  );
  registration.enhance(document);
  await settle();
  assert.equal(document.querySelectorAll(".vx-member-registration").length, 2);
  assert.equal(document.querySelector(".vx-op-badge"), null);
  const activity = document.querySelector(".latest-activity");
  assert.equal(activity.parentElement.querySelector(":scope > span:first-of-type"), activity);
  assert.equal(activity.textContent, "Bob 3 分钟前");
  assert.equal(activity.previousElementSibling.tagName, "SMALL");
  assert.deepEqual(
    [...document.querySelectorAll(".vx-member-registration")].map((node) => node.textContent),
    ["注册于 2021-01-01", "注册于 2021-01-01"],
  );
});

test("registration requests are limited to four concurrent users", async () => {
  dom(
    `<div id="Main">${Array.from(
      { length: 8 },
      (_, index) =>
        `<div class="cell item"><span class="item_title"><a href="/t/${index + 1}">Topic</a></span><span class="topic_info"><a href="/member/User${index}">User${index}</a></span></div>`,
    ).join("")}</div>`,
    "https://www.v2ex.com/?tab=all",
  );
  const pending = [];
  let active = 0;
  let maximum = 0;
  createMemberRegistration(createStorage(memoryAPI()), { showMemberRegistration: true }, (path) => {
    active++;
    maximum = Math.max(maximum, active);
    const name = new URL(path, location.href).searchParams.get("username");
    return new Promise((resolve) =>
      pending.push(() => {
        active--;
        resolve(response(name, 1_609_459_200));
      }),
    );
  }).enhance(document);
  await settle();
  assert.equal(pending.length, 4);
  while (pending.length) {
    pending.splice(0).forEach((resolve) => resolve());
    await settle();
    await settle();
  }
  assert.equal(maximum, 4);
  assert.equal(document.querySelectorAll(".vx-member-registration").length, 8);
});
