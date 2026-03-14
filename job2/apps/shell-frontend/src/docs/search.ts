import { DOC_CATALOG, type DocItem } from "./catalog.ts";

export type DocSearchResult =
  | { kind: "doc"; item: DocItem }
  | { kind: "local"; title: string; path: string; preview: string };

function norm(s: string) {
  return s.toLowerCase().trim();
}

export function searchCatalog(query: string): DocItem[] {
  const q = norm(query);
  if (!q) return [];

  return DOC_CATALOG
    .map((d) => {
      const hay = norm([d.title, d.url, ...d.keywords].join(" "));
      const score =
        (hay.includes(q) ? 10 : 0) +
        d.keywords.filter((k) => norm(k).includes(q)).length * 3 +
        (norm(d.title).includes(q) ? 4 : 0);

      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.d);
}