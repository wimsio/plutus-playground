import { DOC_INDEX } from "./docsIndex.ts";

export function searchDocs(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return DOC_INDEX.filter((doc) => {
    const text = [doc.title, ...doc.keywords].join(" ").toLowerCase();
    return text.includes(q);
  });
}