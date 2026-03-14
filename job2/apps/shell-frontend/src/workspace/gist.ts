import type { ImportedFile } from "./importers";

/**
 * Accepts:
 * - gist id: "aa5a315d61ae9438b18d"
 * - gist url: "https://gist.github.com/user/aa5a315d61ae9438b18d"
 * - url with fragment: ".../aa5a...#file-main-ts"
 * - url ending: ".../aa5a....git"
 */
export function parseGistId(idOrUrl: string): string | null {
  const raw = (idOrUrl ?? "").trim();
  if (!raw) return null;

  // already an id
  if (/^[a-f0-9]{5,}$/i.test(raw) && !raw.includes("/")) return raw;

  // Try parsing as URL
  try {
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter(Boolean);

    // gist.github.com/{user}/{id}
    // sometimes gist id comes with ".git"
    let last = parts[parts.length - 1] || "";
    last = last.replace(/\.git$/i, "");
    if (/^[a-f0-9]{5,}$/i.test(last)) return last;

    return null;
  } catch {
    // Not a URL; try to extract id from a random string
    const m = raw.match(/([a-f0-9]{5,})/i);
    return m ? m[1] : null;
  }
}

/**
 * Optional: pass a GitHub token to avoid rate limits.
 * Token can be fine-grained/personal access token with public gist read.
 */
export async function fetchGistFiles(gistId: string, token?: string): Promise<ImportedFile[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, { headers });
  if (!r.ok) {
    // helpful error
    const txt = await r.text().catch(() => "");
    throw new Error(`GitHub Gist fetch failed (${r.status}). ${txt.slice(0, 180)}`);
  }

  const j = await r.json();
  const files = j?.files ?? {};

  const out: ImportedFile[] = [];
  for (const key of Object.keys(files)) {
    const f = files[key];
    if (!f) continue;

    // Prefer inline content, else fetch raw_url
    if (typeof f.content === "string") {
      out.push({ path: key, content: f.content });
      continue;
    }

    if (typeof f.raw_url === "string") {
      const rr = await fetch(f.raw_url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const txt = await rr.text();
      out.push({ path: key, content: txt });
    }
  }

  return out;
}