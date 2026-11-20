import { element } from "./dom.js";
import { t } from "./i18n.js";

const homepage = "https://github.com/jetyu/v2ex-kit";
const references = [
  ["V2EX Polish", "https://github.com/coolpace/V2EX_Polish", "aboutPolish"],
  ["V2EX.REP", "https://github.com/v2hot/v2ex.rep", "aboutRep"],
  ["V2EX Plus", "https://github.com/thinktip/v2ex-plus", "aboutPlus"],
  ["V2EX Theme", "https://github.com/yuyinws/v2ex-theme", "aboutTheme"],
];

function link(label, url) {
  const anchor = element("a", label);
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

export function createAbout() {
  const root = element("div", undefined, "vx-about");
  root.append(element("h2", "V2EX Kit"), element("p", t("aboutDescription")));
  const links = element("div", undefined, "vx-about-links");
  links.append(
    link(t("projectHomepage"), homepage),
    link(t("reportIssue"), `${homepage}/issues`),
    link(t("mitLicense"), `${homepage}/blob/main/LICENSE`),
  );
  root.append(links, element("h3", t("aboutReferences")));
  const list = element("ul");
  for (const [name, url, description] of references) {
    const item = element("li");
    item.append(link(name, url), element("p", t(description)));
    list.append(item);
  }
  root.append(list);
  return root;
}
