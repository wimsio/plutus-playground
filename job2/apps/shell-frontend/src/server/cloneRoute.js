import express from "express";
import os from "os";
import fs from "fs/promises";
import path from "path";
import { simpleGit } from "simple-git";
import fg from "fast-glob";

const router = express.Router();

function isProbablyText(buf) {
  // quick heuristic: if there are many zero bytes, treat as binary
  let zeros = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0) zeros++;
  return zeros === 0;
}

router.post("/api/workspace/:project/clone", express.urlencoded({ extended: false }), async (req, res) => {
  const repoUrl = String(req.body.repoUrl || "").trim();
  if (!repoUrl) return res.json({ ok: false, error: "Missing repoUrl" });

  // Basic allowlist: http(s) git URLs only (avoid local paths)
  if (!/^https?:\/\/.+/i.test(repoUrl) && !/^git@.+:.+/.test(repoUrl)) {
    return res.json({ ok: false, error: "Repo URL must be https://... or git@...:..." });
  }

  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), "cardano-ide-clone-"));
  const repoDir = path.join(tmpBase, "repo");

  try {
    const git = simpleGit();
    await git.clone(repoUrl, repoDir, ["--depth", "1"]);

    // Pick files (ignore big + common junk)
    const paths = await fg(["**/*"], {
      cwd: repoDir,
      dot: true,
      onlyFiles: true,
      ignore: [
        "**/.git/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/target/**",
        "**/*.png",
        "**/*.jpg",
        "**/*.jpeg",
        "**/*.gif",
        "**/*.pdf",
        "**/*.zip",
        "**/*.wasm",
      ],
    });

    const files = [];
    const MAX_FILES = 400;
    const MAX_FILE_BYTES = 250_000; // 250 KB per file (keeps payload sane)

    for (const rel of paths.slice(0, MAX_FILES)) {
      const abs = path.join(repoDir, rel);
      const buf = await fs.readFile(abs);

      if (buf.length > MAX_FILE_BYTES) continue;
      if (!isProbablyText(buf)) continue;

      files.push({ path: rel.replace(/\\/g, "/"), content: buf.toString("utf8") });
    }

    return res.json({ ok: true, files });
  } catch (e) {
    console.error("[clone] failed:", e);
    return res.json({ ok: false, error: e?.message || "Clone failed" });
  } finally {
    // best-effort cleanup
    try {
      await fs.rm(tmpBase, { recursive: true, force: true });
    } catch {}
  }
});

export default router;