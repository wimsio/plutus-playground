import type { ImportedFile } from "./importers.ts";

function parseIpfsRef(ref: string): { cid: string; path: string } | null {
  const s = ref.trim();

  // ipfs://CID/path...
  if (s.startsWith("ipfs://")) {
    const rest = s.slice("ipfs://".length);
    const [cid, ...p] = rest.split("/").filter(Boolean);
    if (!cid) return null;
    return { cid, path: p.join("/") };
  }

  // CID only
  if (/^[a-zA-Z0-9]+$/.test(s) && s.length >= 10) {
    return { cid: s, path: "" };
  }

  // https://gateway/ipfs/CID/path...
  const m = s.match(/\/ipfs\/([^/]+)\/?(.*)$/i);
  if (m) return { cid: m[1], path: m[2] || "" };

  return null;
}

export async function importFromIpfsRef(ref: string): Promise<ImportedFile[]> {
  const parsed = parseIpfsRef(ref);
  if (!parsed) throw new Error("Invalid IPFS reference");

  // Basic gateway approach (good enough to start)
  const gateway = "https://ipfs.io/ipfs";
  const url = `${gateway}/${parsed.cid}${parsed.path ? "/" + parsed.path : ""}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`IPFS fetch failed: ${r.status}`);

  const content = await r.text();
  const filename = parsed.path?.split("/").filter(Boolean).pop() || `${parsed.cid}.txt`;

  return [{ path: filename, content }];
}