import { t } from "./i18n.js";

// Navigation artwork used by V2EX Plus. See THIRD-PARTY-NOTICES.md.
const TAB_ICONS = {
  技术: '<polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />',
  创意: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" />',
  好玩: '<line x1="6" x2="10" y1="12" y2="12" /><line x1="8" x2="8" y1="10" y2="14" /><line x1="15" x2="15.01" y1="13" y2="13" /><line x1="18" x2="18.01" y1="11" y2="11" /><rect width="20" height="12" x="2" y="6" rx="2" />',
  Apple:
    '<svg width="14" height="14" viewBox="-1.5 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g transform="translate(-102.000000, -7439.000000)" fill="currentColor"><g transform="translate(56.000000, 160.000000)"><path d="M57.5708873,7282.19296 C58.2999598,7281.34797 58.7914012,7280.17098 58.6569121,7279 C57.6062792,7279.04 56.3352055,7279.67099 55.5818643,7280.51498 C54.905374,7281.26397 54.3148354,7282.46095 54.4735932,7283.60894 C55.6455696,7283.69593 56.8418148,7283.03894 57.5708873,7282.19296 M60.1989864,7289.62485 C60.2283111,7292.65181 62.9696641,7293.65879 63,7293.67179 C62.9777537,7293.74279 62.562152,7295.10677 61.5560117,7296.51675 C60.6853718,7297.73474 59.7823735,7298.94772 58.3596204,7298.97372 C56.9621472,7298.99872 56.5121648,7298.17973 54.9134635,7298.17973 C53.3157735,7298.17973 52.8162425,7298.94772 51.4935978,7298.99872 C50.1203933,7299.04772 49.0738052,7297.68074 48.197098,7296.46676 C46.4032359,7293.98379 45.0330649,7289.44985 46.8734421,7286.3899 C47.7875635,7284.87092 49.4206455,7283.90793 51.1942837,7283.88393 C52.5422083,7283.85893 53.8153044,7284.75292 54.6394294,7284.75292 C55.4635543,7284.75292 57.0106846,7283.67793 58.6366882,7283.83593 C59.3172232,7283.86293 61.2283842,7284.09893 62.4549652,7285.8199 C62.355868,7285.8789 60.1747177,7287.09489 60.1989864,7289.62485"></path></g></g></g></svg>',
  酷工作:
    '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" />',
  交易: '<path d="m21 16-2 6H5l-2-6" /><path d="M3 6v10c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V6" /><path d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />',
  城市: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" />',
  问与答:
    '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />',
  最热: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.243-2.143.5-3.5a6 6 0 0 1 1.5-2.5c-.002 1.25.502 2.5 1.5 3.5.5.5 1 1.5 1 3a2 2 0 0 1-2 2z" />',
  全部: '<rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />',
  R2: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" x2="12" y1="22.08" y2="12" />',
  VXNA: '<path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />',
  节点: '<line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="15" y2="15" /><line x1="10" x2="8" y1="3" y2="21" /><line x1="16" x2="14" y1="3" y2="21" />',
  关注: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />',
  Planet:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="2" x2="22" y1="12" y2="12"/>',
};
const iconPaths = {
  home: '<path d="M15 21v-8a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  notes:
    '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>',
  planet:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="2" x2="22" y1="12" y2="12"/>',
  settings:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m21 15-5-5L5 21"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
  language: '<path d="m5 8 6 6m-7 0 6-6 2-5H2m5-2v2m7 18 5-11 5 11m-8-4h6"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M3 12h12m-4-4 4 4-4 4"/>',
  signup: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m3-13v6m-3-3h6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4"/>',
  nodes:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  timeline: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
};

function prependIcon(link, paths) {
  if (!paths || link.querySelector("svg")) return;
  const markup = paths.startsWith("<svg")
    ? paths
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  link.insertAdjacentHTML("afterbegin", markup);
}

const topIcons = [
  [/^\/$/, "home"],
  [/^\/member\//, "user"],
  [/^\/notes/, "notes"],
  [/^\/planet/, "planet"],
  [/^\/settings/, "settings"],
  [/signout/, "logout"],
  [/^\/signin/, "login"],
  [/^\/signup/, "signup"],
  [/^\/notifications/, "bell"],
  [/^\/my\/nodes/, "nodes"],
  [/^\/my\//, "bookmark"],
  [/^\/images/, "image"],
  [/^\/chat/, "chat"],
  [/^\/timeline/, "timeline"],
  [/^\/select\/language/, "language"],
];

const modes = ["light", "dark", "auto"];
const modeIcons = {
  light:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  dark: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  auto: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8m-4-4v4"/>',
};

function installThemeSwitch(doc) {
  const host = doc.querySelector("#Top .tools, #site-header");
  if (!host) return;
  const root = doc.documentElement;
  const control = doc.createElement("button");
  control.type = "button";
  control.id = "v2p-lite-theme-toggle";
  control.className = "top";
  const mode = () => (modes.includes(root.dataset.siteTheme) ? root.dataset.siteTheme : "auto");
  const draw = () => {
    const active = mode();
    control.replaceChildren();
    prependIcon(control, modeIcons[active]);
    control.title = t("plusThemeMode", t(`plusTheme-${active}`));
    control.setAttribute("aria-label", control.title);
    control.dataset.mode = active;
  };
  control.addEventListener("click", () => {
    const next = modes[(modes.indexOf(mode()) + 1) % modes.length];
    const page = globalThis.unsafeWindow;
    if (typeof page?.setSiteThemeMedia === "function") page.setSiteThemeMedia(next);
    else root.dataset.siteTheme = next;
    page?.storeSiteTheme?.(next);
    draw();
  });
  host.insertBefore(control, host.querySelector("#site-header-menu"));
  draw();
}

export function installPlusNavigation(doc, openSettings) {
  for (const link of doc.querySelectorAll("#Top .tools > a.top, #menu-body a.top")) {
    const href = link.getAttribute("href") ?? "";
    const name = topIcons.find(([pattern]) => pattern.test(href))?.[1];
    if (!name) continue;
    link.querySelector("img.tool-icon")?.remove();
    link.classList.add("v2p-lite-topnav-icon");
    link.dataset.v2pLiteTopnavIcon = name;
    prependIcon(link, iconPaths[name]);
  }
  installThemeSwitch(doc);

  const tabs = doc.getElementById("Tabs");
  if (tabs) {
    const planet = tabs.querySelector('a[href="/planet"]');
    if (planet) {
      planet.replaceChildren();
      planet.classList.add("tab");
      planet.setAttribute("aria-label", "Planet");
      planet.title = "Planet";
      prependIcon(planet, TAB_ICONS.Planet);
    }
    if (!tabs.querySelector('a[href="/?tab=nodes"]')) {
      const nodes = doc.createElement("a");
      nodes.href = "/?tab=nodes";
      nodes.className = "tab";
      nodes.textContent = "\u8282\u70b9";
      tabs.append(nodes);
    }
    for (const tab of tabs.querySelectorAll("a.tab, a.tab_current")) {
      const label = tab.textContent.trim();
      if (label === "\u62fc\u8f66") {
        tab.remove();
        continue;
      }
      if (Object.hasOwn(TAB_ICONS, label)) prependIcon(tab, TAB_ICONS[label]);
    }

    const settings = doc.createElement("button");
    settings.type = "button";
    settings.className = "v2p-nav-settings-btn";
    settings.setAttribute("aria-label", t("settings"));
    prependIcon(settings, iconPaths.settings);
    settings.addEventListener("click", openSettings);
    tabs.append(settings);
  }

  if (!doc.documentElement.hasAttribute("data-v2p-mobile")) return;
  const menu = doc.querySelector("#site-header #menu-entry:has(.menu-guest)");
  if (menu) {
    prependIcon(menu, '<path d="M4 6h16M4 12h16M4 18h16"/>');
    menu.querySelector("svg")?.classList.add("v2p-mobile-menu-icon");
  }

  for (const title of doc.querySelectorAll("#Main .cell.item .item_title")) {
    const cell = title.parentElement;
    const metadata = [...cell.children].filter((child) => child.matches(".small, .topic_info"));
    const identity = metadata.find((child) => child.querySelector('a[href^="/member/"]'));
    const timestamp = metadata.find((child) => child !== identity);
    if (!identity || !timestamp) continue;
    const author = identity.querySelector('a[href^="/member/"]');
    const node = identity.querySelector("a.node, .item_node");
    const time = timestamp.textContent.split(/[\u2022\u00b7]/)[0].trim();
    const row = doc.createElement("span");
    row.className = "small fade v2p-mobile-topic-meta";
    for (const part of [node, author, time].filter(Boolean)) {
      if (row.childNodes.length) row.append(" \u00b7 ");
      row.append(part);
    }
    for (const child of [...cell.children]) {
      if (metadata.includes(child) || child.matches(".sep5")) child.remove();
    }
    title.after(row);
    cell.classList.add("v2p-mobile-topic-text");
  }
}
