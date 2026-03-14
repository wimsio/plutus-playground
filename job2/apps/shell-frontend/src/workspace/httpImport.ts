import type { ImportedFile } from "./importers.ts";

function inferNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last || "imported.txt";
  } catch {
    return "imported.txt";
  }
}

export async function importFromHttpUrl(url: string): Promise<ImportedFile[]> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL must be http(s)://");
  }

  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);

  const text = await r.text();
  const name = inferNameFromUrl(url);
  return [{ path: name, content: text }];
}