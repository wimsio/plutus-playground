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
  host,
  nodes,
  collapsed,
  setCollapsed,
  onOpenFile,
  depth = 0,
}: {
  host: HostApi;
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
                  host={host}
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
  const project = (host as any)?.project ?? DEFAULT_PROJECT; // fallback if HostApi doesn’t expose it
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const j = await apiJson<{ items: TreeNode[] }>(`${API}/api/workspace/${project}/tree?path=`);
    setTree(j.items ?? []);
  }

  useEffect(() => {
    refresh().catch((e) => host.ui?.notify?.(`Tree refresh failed: ${String(e?.message ?? e)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openFile(path: string) {
    try {
      // Prefer a host command if your app exposes it (clean plugin boundary)
      const cmd = host.commands?.get?.("editor.openFile");
      if (cmd) {
        await cmd({ path });
        return;
      }

      // Fallback: notify (your main app can wire editor.openFile later)
      host.ui?.notify?.(`Open file: ${path} (wire editor.openFile command)`);
    } catch (e: any) {
      host.ui?.notify?.(`Open failed: ${String(e?.message ?? e)}`);
    }
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

      <Tree
        host={host}
        nodes={tree}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onOpenFile={openFile}
      />
    </div>
  );
}

const plugin: PluginDefinition = {
  id: "plugin.file-explorer",
  name: "File Explorer",
  version: "0.2.1",
  activate(host) {
    host.panels.register({
      id: "file.explorer",
      title: "Files",
      location: "left",
      render: () => <Explorer host={host} />,
    });
  },
};

export default plugin;