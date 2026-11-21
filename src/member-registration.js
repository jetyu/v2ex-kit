import { element, matching, memberName, owned } from "./dom.js";
import { t } from "./i18n.js";
import { fetchMemberSummary } from "./member-data.js";
import { REPLY } from "./reply-actions.js";

const CACHE_KEY = "member-registration-cache:v1";
const CACHE_LIMIT = 1_000;
const MAX_CONCURRENT = 4;
const validName = /^[a-z0-9_-]{1,64}$/i;

function validCreated(value) {
  return Number.isSafeInteger(value) && value > 0 && value < 5_000_000_000;
}

export function registrationDate(created) {
  if (!validCreated(created)) return "";
  const date = new Date(created * 1000 + 8 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function replyAuthor(reply) {
  return [...reply.querySelectorAll('strong a[href^="/member/"]')].find(
    (link) => link.closest(REPLY) === reply && memberName(link),
  );
}

function topicListAuthor(row) {
  const info = row.querySelector(".topic_info,.v2p-mobile-topic-meta,.topic-meta,.item_info");
  return [...(info?.querySelectorAll('a[href^="/member/"]') ?? [])].find(memberName);
}

export function createMemberRegistration(store, options, fetcher = fetch) {
  if (!options.showMemberRegistration) return { enhance() {}, summary: () => null };

  const dates = new Map();
  const summaries = new Map();
  const pending = new Map();
  const queue = [];
  const decorated = new WeakSet();
  let active = 0;

  const saved = store.get(CACHE_KEY, {});
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    for (const [name, created] of Object.entries(saved).slice(-CACHE_LIMIT)) {
      if (validName.test(name) && validCreated(created)) dates.set(name.toLowerCase(), created);
    }
  }

  function persist(name, created) {
    dates.delete(name);
    dates.set(name, created);
    while (dates.size > CACHE_LIMIT) dates.delete(dates.keys().next().value);
    store.set(CACHE_KEY, Object.fromEntries(dates));
  }

  function pump() {
    while (active < MAX_CONCURRENT && queue.length) {
      const task = queue.shift();
      active++;
      const signal = AbortSignal.timeout(10_000);
      Promise.resolve()
        .then(() => fetchMemberSummary(task.name, signal, fetcher))
        .then((data) => {
          const created = Number(data.created);
          if (!validCreated(created)) throw new Error(t("memberRegistrationUnavailable"));
          summaries.set(task.key, data);
          persist(task.key, created);
          task.resolve(created);
        })
        .catch(task.reject)
        .finally(() => {
          active--;
          pending.delete(task.key);
          pump();
        });
    }
  }

  function load(name) {
    const key = name.toLowerCase();
    if (dates.has(key)) return Promise.resolve(dates.get(key));
    if (pending.has(key)) return pending.get(key);
    let resolve;
    let reject;
    const promise = new Promise((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    pending.set(key, promise);
    queue.push({ key, name, resolve, reject });
    pump();
    return promise;
  }

  function decorate(link, context = "reply") {
    const name = memberName(link);
    if (!name || decorated.has(link)) return;
    decorated.add(link);
    // Plus theme keeps the native latest-activity line visible through
    // `.topic_info span:first-of-type`; inserting another span before it would
    // take that position and cover the original relative time.
    const tag = context === "topic-list" ? "small" : "span";
    const meta = owned(element(tag, undefined, `vx-member-inline-meta vx-${context}-member-meta`));
    const joined = element("span", undefined, "vx-member-registration");
    joined.hidden = true;
    meta.append(joined);
    (link.closest("strong") ?? link).after(meta);
    void load(name)
      .then((created) => {
        if (!meta.isConnected) return;
        const date = registrationDate(created);
        if (!date) return;
        joined.textContent = t("memberRegistered", date);
        joined.title = t("memberRegisteredTitle", name, date);
        joined.hidden = false;
      })
      .catch(() => {
        joined.remove();
        if (!meta.childElementCount) meta.remove();
      });
  }

  function enhanceTopicHeader(root) {
    for (const header of matching(root, "#Main .header")) {
      if (!header.querySelector("h1")) continue;
      const links = [...header.querySelectorAll('a[href^="/member/"]')].filter(memberName);
      const link =
        links.find(
          (candidate) =>
            candidate.closest("small,.gray,.topic_info") && !candidate.querySelector("img.avatar"),
        ) ?? links.find((candidate) => !candidate.querySelector("img.avatar"));
      const name = memberName(link);
      if (!link || !name) continue;
      decorate(link, "topic-author");
      break;
    }
  }

  function enhanceTopicLists(root) {
    for (const row of matching(root, ".cell.item,.topic-item")) {
      if (!row.querySelector('.item_title a[href*="/t/"],a.topic-link[href*="/t/"]')) continue;
      const link = topicListAuthor(row);
      if (link) decorate(link, "topic-list");
    }
  }

  function enhanceReplies(root) {
    for (const reply of matching(root, REPLY)) {
      const link = replyAuthor(reply);
      if (link) decorate(link, "reply");
    }
  }

  return {
    enhance(root) {
      if (/^\/t\/\d+\/?$/.test(location.pathname)) {
        enhanceTopicHeader(root);
        enhanceReplies(root);
      } else enhanceTopicLists(root);
    },
    summary(name) {
      const key = name.toLowerCase();
      return summaries.get(key) ?? pending.get(key) ?? null;
    },
  };
}
