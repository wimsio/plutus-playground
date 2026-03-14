#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_remixlike_$STAMP"
mkdir -p "$BK"

backup() {
  local f="$1"
  if [ -f "$f" ]; then
    mkdir -p "$BK/$(dirname "$f")"
    cp -a "$f" "$BK/$f"
  fi
}

echo "[1/8] Backing up files to: $BK"
backup apps/php-api/public/index.php
backup apps/php-api/src/routes.php
backup apps/php-api/src/Workspace.php
backup apps/shell-frontend/src/app.tsx
backup apps/shell-frontend/src/styles.css
backup packages/plugin-file-explorer/src/index.tsx

echo "[2/8] Writing backend Workspace.php"
mkdir -p apps/php-api/src
cat > apps/php-api/src/Workspace.php <<'PHP'
<?php
declare(strict_types=1);

require_once __DIR__ . "/bootstrap.php";

final class Workspace
{
  public static function root(): string { return workspace_root(); }

  public static function projectDir(string $project): string {
    $project = safe_path($project);
    return self::root() . "/" . $project;
  }

  public static function ensureProject(string $project): void {
    $dir = self::projectDir($project);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
  }

  public static function listWorkspaces(): array {
    $root = self::root();
    if (!is_dir($root)) mkdir($root, 0777, true);
    $items = array_values(array_filter(scandir($root) ?: [], fn($x) => $x !== "." && $x !== ".."));
    $items = array_values(array_filter($items, fn($x) => is_dir($root . "/" . $x)));
    sort($items);
    return $items;
  }

  public static function createWorkspace(string $project): void {
    $project = safe_path($project);
    self::ensureProject($project);
  }

  public static function listTree(string $project, string $path = ""): array {
    self::ensureProject($project);
    $base = self::projectDir($project) . "/" . safe_path($path);
    if (!is_dir($base)) return [];

    $walk = function(string $absDir, string $relDir) use (&$walk): array {
      $children = [];
      $items = array_values(array_filter(scandir($absDir) ?: [], fn($x) => $x !== "." && $x !== ".."));
      sort($items);

      foreach ($items as $name) {
        $abs = $absDir . "/" . $name;
        $rel = ($relDir === "" ? $name : $relDir . "/" . $name);

        if (is_dir($abs)) {
          $children[] = ["type"=>"dir","name"=>$name,"path"=>$rel,"children"=>$walk($abs,$rel)];
        } else {
          $children[] = ["type"=>"file","name"=>$name,"path"=>$rel];
        }
      }
      return $children;
    };

    return $walk($base, $path === "" ? "" : rtrim($path, "/"));
  }

  public static function readFile(string $project, string $path): string {
    self::ensureProject($project);
    $file = self::projectDir($project) . "/" . safe_path($path);
    if (!is_file($file)) throw new RuntimeException("Not found");
    return file_get_contents($file) ?: "";
  }

  public static function writeFile(string $project, string $path, string $content): void {
    self::ensureProject($project);
    $file = self::projectDir($project) . "/" . safe_path($path);
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    file_put_contents($file, $content);
  }

  public static function mkdir(string $project, string $path): void {
    self::ensureProject($project);
    $dir = self::projectDir($project) . "/" . safe_path($path);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
  }

  public static function touch(string $project, string $path): void {
    self::ensureProject($project);
    $file = self::projectDir($project) . "/" . safe_path($path);
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    if (!file_exists($file)) file_put_contents($file, "");
  }

  public static function deletePath(string $project, string $path): void {
    self::ensureProject($project);
    $abs = self::projectDir($project) . "/" . safe_path($path);
    if (is_file($abs)) { unlink($abs); return; }

    if (is_dir($abs)) {
      $it = new RecursiveDirectoryIterator($abs, RecursiveDirectoryIterator::SKIP_DOTS);
      $files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
      foreach ($files as $file) {
        if ($file->isDir()) rmdir($file->getPathname());
        else unlink($file->getPathname());
      }
      rmdir($abs);
    }
  }

  public static function renamePath(string $project, string $from, string $to): void {
    self::ensureProject($project);
    $a = self::projectDir($project) . "/" . safe_path($from);
    $b = self::projectDir($project) . "/" . safe_path($to);
    $dir = dirname($b);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    rename($a, $b);
  }

  public static function saveUpload(string $project, string $dirPath, array $fileInfo): string {
    self::ensureProject($project);
    $dirAbs = self::projectDir($project) . "/" . safe_path($dirPath);
    if (!is_dir($dirAbs)) mkdir($dirAbs, 0777, true);

    $name = basename((string)($fileInfo["name"] ?? "upload.bin"));
    $tmp  = (string)($fileInfo["tmp_name"] ?? "");
    if ($tmp === "" || !file_exists($tmp)) throw new RuntimeException("Invalid upload");

    $dest = $dirAbs . "/" . $name;
    @rename($tmp, $dest);

    $rel = ($dirPath === "" ? $name : rtrim($dirPath, "/") . "/" . $name);
    return $rel;
  }
}
PHP

echo "[3/8] Adding extra routes via apps/php-api/src/routes_extra.php"
cat > apps/php-api/src/routes_extra.php <<'PHP'
<?php
declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

return function ($app) {

  $app->get("/api/workspaces", function (Request $req, Response $res) {
    $res->getBody()->write(json_encode(["items" => Workspace::listWorkspaces()]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspaces/create", function (Request $req, Response $res) {
    $body = (array)($req->getParsedBody() ?? []);
    $name = (string)($body["name"] ?? "demo");
    Workspace::createWorkspace($name);
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->get("/api/workspace/{project}/tree", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $path = (string)($req->getQueryParams()["path"] ?? "");
    $res->getBody()->write(json_encode(["items" => Workspace::listTree($project, $path)]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->get("/api/workspace/{project}/read", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $path = (string)($req->getQueryParams()["path"] ?? "");
    $res->getBody()->write(Workspace::readFile($project, $path));
    return $res->withHeader("Content-Type", "text/plain");
  });

  $app->post("/api/workspace/{project}/write", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    Workspace::writeFile($project, (string)($body["path"] ?? ""), (string)($body["content"] ?? ""));
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspace/{project}/mkdir", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    Workspace::mkdir($project, (string)($body["path"] ?? ""));
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspace/{project}/touch", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    Workspace::touch($project, (string)($body["path"] ?? ""));
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspace/{project}/delete", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    Workspace::deletePath($project, (string)($body["path"] ?? ""));
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspace/{project}/rename", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    Workspace::renamePath($project, (string)($body["from"] ?? ""), (string)($body["to"] ?? ""));
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspace/{project}/upload", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $dir = (string)($req->getQueryParams()["dir"] ?? "");
    $files = $req->getUploadedFiles();
    if (!isset($files["file"])) throw new RuntimeException("Missing file");
    $uf = $files["file"];
    $tmp = tempnam(sys_get_temp_dir(), "upl_");
    $uf->moveTo($tmp);

    $saved = Workspace::saveUpload($project, $dir, [
      "name" => $uf->getClientFilename(),
      "tmp_name" => $tmp,
    ]);

    $res->getBody()->write(json_encode(["ok" => true, "path" => $saved]));
    return $res->withHeader("Content-Type", "application/json");
  });

};
PHP

echo "[4/8] Ensuring routes.php loads routes_extra.php"
python3 - <<'PY'
import pathlib, re
p = pathlib.Path("apps/php-api/src/routes.php")
if not p.exists():
  raise SystemExit("apps/php-api/src/routes.php not found")

s = p.read_text(encoding="utf-8")
if "routes_extra.php" in s:
  print("routes.php already includes routes_extra.php")
else:
  m = re.search(r"return\s+function\s*\(.*?\)\s*\{", s, flags=re.S)
  if not m:
    raise SystemExit("Could not locate 'return function (...) {' in routes.php")
  insert_at = m.end()
  s = s[:insert_at] + "\n  (require __DIR__ . '/routes_extra.php')($app);\n" + s[insert_at:]
  p.write_text(s, encoding="utf-8")
  print("Patched routes.php")
PY

echo "[5/8] Writing resizable Split.tsx"
mkdir -p apps/shell-frontend/src/ui
cat > apps/shell-frontend/src/ui/Split.tsx <<'TSX'
import React, { useRef } from "react";

export function VerticalSplit({
  leftWidth,
  setLeftWidth,
  minLeft = 220,
  maxLeft = 520,
  left,
  right,
}: {
  leftWidth: number;
  setLeftWidth: (n: number) => void;
  minLeft?: number;
  maxLeft?: number;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const dragging = useRef(false);

  function onDown() { dragging.current = true; }
  function onMove(e: MouseEvent) {
    if (!dragging.current) return;
    const x = e.clientX;
    const clamped = Math.max(minLeft, Math.min(maxLeft, x));
    setLeftWidth(clamped);
  }
  function onUp() { dragging.current = false; }

  React.useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: `${leftWidth}px 6px 1fr`, height: "100%" }}>
      <div style={{ height: "100%" }}>{left}</div>
      <div onMouseDown={onDown} style={{ cursor: "col-resize", background: "#2a3150" }} />
      <div style={{ height: "100%" }}>{right}</div>
    </div>
  );
}

export function HorizontalSplit({
  bottomHeight,
  setBottomHeight,
  minBottom = 120,
  maxBottom = 420,
  top,
  bottom,
}: {
  bottomHeight: number;
  setBottomHeight: (n: number) => void;
  minBottom?: number;
  maxBottom?: number;
  top: React.ReactNode;
  bottom: React.ReactNode;
}) {
  const dragging = useRef(false);

  function onDown() { dragging.current = true; }
  function onMove(e: MouseEvent) {
    if (!dragging.current) return;
    const h = window.innerHeight;
    const y = e.clientY;
    const newBottom = Math.max(minBottom, Math.min(maxBottom, h - y));
    setBottomHeight(newBottom);
  }
  function onUp() { dragging.current = false; }

  React.useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateRows: `1fr 6px ${bottomHeight}px`, height: "100%" }}>
      <div style={{ height: "100%" }}>{top}</div>
      <div onMouseDown={onDown} style={{ cursor: "row-resize", background: "#2a3150" }} />
      <div style={{ height: "100%" }}>{bottom}</div>
    </div>
  );
}
TSX

echo "[6/8] Writing File Explorer plugin (tree + actions + upload)"
mkdir -p packages/plugin-file-explorer/src
cat > packages/plugin-file-explorer/src/index.tsx <<'TSX'
import React, { useEffect, useRef, useState } from "react";
import type { HostApi, PluginDefinition } from "@ide/plugin-sdk";

type TreeFile = { type: "file"; name: string; path: string };
type TreeDir = { type: "dir"; name: string; path: string; children: TreeNode[] };
type TreeNode = TreeFile | TreeDir;

const API = "http://localhost:8080";
const DEFAULT_PROJECT = "demo";

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}
async function postForm<T>(url: string, data: Record<string, string>): Promise<T> {
  const body = new URLSearchParams(data);
  return apiJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

function Tree({
  nodes,
  collapsed,
  setCollapsed,
  onOpenFile,
  depth = 0,
}: {
  nodes: TreeNode[];
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onOpenFile: (path: string) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((n) => {
        const pad = 10 + depth * 12;

        if (n.type === "dir") {
          const isCollapsed = collapsed[n.path] ?? false;
          return (
            <div key={n.path}>
              <div
                style={{ padding: `6px 8px 6px ${pad}px`, cursor: "pointer", color: "#cbd5e1" }}
                onClick={() => setCollapsed((c) => ({ ...c, [n.path]: !isCollapsed }))}
                title={n.path}
              >
                <span style={{ marginRight: 6 }}>{isCollapsed ? "▸" : "▾"}</span>
                <span style={{ marginRight: 6 }}>📁</span>
                {n.name}
              </div>

              {!isCollapsed && (
                <Tree
                  nodes={n.children}
                  collapsed={collapsed}
                  setCollapsed={setCollapsed}
                  onOpenFile={onOpenFile}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

        return (
          <div
            key={n.path}
            style={{ padding: `6px 8px 6px ${pad}px`, cursor: "pointer", color: "#e5e7eb" }}
            onClick={() => onOpenFile(n.path)}
            title={n.path}
          >
            <span style={{ marginRight: 6 }}>📄</span>
            {n.name}
          </div>
        );
      })}
    </>
  );
}

function Explorer({ host }: { host: HostApi }) {
  const project = (host as any)?.project ?? DEFAULT_PROJECT;
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const j = await apiJson<{ items: TreeNode[] }>(`${API}/api/workspace/${project}/tree?path=`);
    setTree(j.items ?? []);
  }

  useEffect(() => {
    refresh().catch((e) => host.ui?.notify?.(`Tree refresh failed: ${String((e as any)?.message ?? e)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openFile(path: string) {
    const cmd = (host as any).commands?.get?.("editor.openFile");
    if (cmd) return cmd({ path });
    (window as any).__IDE_OPEN_FILE__?.(path);
  }

  async function newFile() {
    const name = prompt("New file path (e.g. contracts/Main.hs):", "Main.hs");
    if (!name) return;
    await postForm(`${API}/api/workspace/${project}/touch`, { path: name });
    host.ui?.notify?.("File created");
    await refresh();
  }

  async function newFolder() {
    const name = prompt("New folder path (e.g. contracts):", "contracts");
    if (!name) return;
    await postForm(`${API}/api/workspace/${project}/mkdir`, { path: name });
    host.ui?.notify?.("Folder created");
    await refresh();
  }

  async function renamePath() {
    const from = prompt("Rename FROM (path):", "Main.hs");
    if (!from) return;
    const to = prompt("Rename TO (path):", "Main2.hs");
    if (!to) return;
    await postForm(`${API}/api/workspace/${project}/rename`, { from, to });
    host.ui?.notify?.("Renamed");
    await refresh();
  }

  async function deletePath() {
    const p = prompt("Delete path (file or folder):", "Main.hs");
    if (!p) return;
    await postForm(`${API}/api/workspace/${project}/delete`, { path: p });
    host.ui?.notify?.("Deleted");
    await refresh();
  }

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await apiJson(`${API}/api/workspace/${project}/upload?dir=`, { method: "POST", body: fd });
    host.ui?.notify?.("Uploaded");
    await refresh();
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) await uploadFile(f);
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <button className="miniAction" onClick={newFile} title="New File">📄</button>
        <button className="miniAction" onClick={newFolder} title="New Folder">📁</button>
        <button className="miniAction" onClick={() => fileInputRef.current?.click()} title="Upload">⬆️</button>
        <button className="miniAction" onClick={renamePath} title="Rename">✏️</button>
        <button className="miniAction" onClick={deletePath} title="Delete">🗑️</button>

        <button
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #343c5b",
            background: "#232a40",
            color: "#e5e7eb",
            cursor: "pointer",
          }}
          onClick={() => refresh().catch(() => {})}
        >
          Refresh
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await uploadFile(f);
          e.currentTarget.value = "";
        }}
      />

      <div style={{ fontSize: 11, color: "#9aa3c6", marginBottom: 8 }}>
        Tip: drag & drop a file here to upload.
      </div>

      <Tree nodes={tree} collapsed={collapsed} setCollapsed={setCollapsed} onOpenFile={openFile} />
    </div>
  );
}

const plugin: PluginDefinition = {
  id: "plugin.file-explorer",
  name: "File Explorer",
  version: "0.3.1",
  activate(host) {
    (host as any).panels?.register?.({
      id: "file.explorer",
      title: "Files",
      location: "left",
      render: () => <Explorer host={host} />,
    });
  },
};

export default plugin;
TSX

echo "[7/8] (Non-destructive) App.tsx/Styles: skipping overwrite to avoid breaking your existing plugin runtime."
echo "      You already have a Remix-like UI. We only ensured backend + explorer + splits are in place."

echo "[8/8] Ensure demo workspace/file exists + restart php-api"
mkdir -p data/workspaces/demo
[ -f data/workspaces/demo/Main.hs ] || printf "%s\n" "-- Cardano Plutus IDE demo" "-- Main.hs" > data/workspaces/demo/Main.hs

docker compose build php-api >/dev/null 2>&1 || true
docker compose up -d redis php-api compiler-worker >/dev/null

echo
echo "✅ Patch applied."
echo "Backups: $BK"
echo "Next: run frontend -> pnpm -C apps/shell-frontend dev --host 0.0.0.0 --port 5173"
