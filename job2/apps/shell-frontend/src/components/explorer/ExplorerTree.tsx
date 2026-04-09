import React, { useEffect, useMemo, useRef, useState } from "react";
import { ideStore, useIDEStore, toPath } from "../../state/store.ts";
import {
  IconFile,
  IconFolder,
  IconUploadFile,
  IconUploadFolder,
  IconIPFS,
  IconHTTP,
  IconChevronDown,
  IconChevronRight,
  IconDoc,
  IconWorkspaceMenu,
  IconCheck,
  IconPlus,
  IconBackup,
  IconRestore,
  IconTrash,
  IconEdit,
  IconDownload,
  IconClone,
} from "./ExplorerIcons";

type WorkspaceMenuAction =
  | "create"
  | "backup"
  | "restore"
  | "delete"
  | "rename"
  | "download"
  | "deleteAll"
  | "clone";

type WorkspaceMenuItem = {
  key: WorkspaceMenuAction;
  label: string;
  icon: React.ReactNode;
};

const WORKSPACE_MENU_ITEMS: WorkspaceMenuItem[] = [
  { key: "create", label: "Create", icon: <IconPlus size={15} /> },
  { key: "backup", label: "Backup", icon: <IconBackup size={15} /> },
  { key: "restore", label: "Restore", icon: <IconRestore size={15} /> },
  { key: "delete", label: "Delete", icon: <IconTrash size={15} /> },
  { key: "rename", label: "Rename", icon: <IconEdit size={15} /> },
  { key: "download", label: "Download", icon: <IconDownload size={15} /> },
  { key: "deleteAll", label: "Delete All", icon: <IconTrash size={15} /> },
  { key: "clone", label: "Clone", icon: <IconClone size={15} /> },
];

export function ExplorerTree() {
  const nodes = useIDEStore((s) => s.nodes);
  const rootId = useIDEStore((s) => s.rootId);
  const currentWorkspace = useIDEStore((s) => s.currentWorkspace);
  const workspaces = useIDEStore((s) => s.workspaces);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [rootId]: true });
  const [selectedId, setSelectedId] = useState<string>(rootId);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState<WorkspaceMenuAction | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const wsDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ideStore.initWorkspaceSystem();
  }, []);

  useEffect(() => {
    setExpanded({ [rootId]: true });
    setSelectedId(rootId);
    setWorkspaceQuery("");
    setWorkspaceDropdownOpen(false);
  }, [currentWorkspace, rootId]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(target)) setWorkspaceDropdownOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function resolveTargetFolderId(): string {
    const sel = nodes[selectedId];
    if (!sel) return rootId;
    if (sel.type === "folder") return sel.id;
    return sel.parentId ?? rootId;
  }

  async function createNewFile() {
    const parentId = resolveTargetFolderId();
    const parentPath = toPath(parentId, nodes);
    const suggested = parentPath ? `${parentPath}/new-file.hs` : "new-file.hs";
    const nameOrPath = prompt("New file name (or path):", suggested);
    if (!nameOrPath) return;

    const simpleName = nameOrPath.includes("/") ? nameOrPath.split("/").pop()! : nameOrPath;
    await ideStore.createNode(parentId, "file", simpleName);
    setExpanded((x) => ({ ...x, [parentId]: true }));
  }

  async function createNewFolder() {
    const parentId = resolveTargetFolderId();
    const parentPath = toPath(parentId, nodes);
    const suggested = parentPath ? `${parentPath}/new-folder` : "new-folder";
    const nameOrPath = prompt("New folder name (or path):", suggested);
    if (!nameOrPath) return;

    const simpleName = nameOrPath.includes("/") ? nameOrPath.split("/").pop()! : nameOrPath;
    await ideStore.createNode(parentId, "folder", simpleName);
    setExpanded((x) => ({ ...x, [parentId]: true }));
  }

  const onOpenFile = async () => {
    const ok = await ideStore.openFromFilePicker?.();
    if (!ok) ideStore.toast("Open canceled or failed.");
  };

  const onUploadFolder = async () => {
    const ok = await ideStore.openFolderFromPicker?.();
    if (!ok) ideStore.toast("Folder import canceled or not supported.");
  };

  const onImportIPFS = async () => {
    const cidOrPath = window.prompt("Paste IPFS CID or ipfs://CID/path:");
    if (!cidOrPath) return;
    await ideStore.importFromIpfs(cidOrPath);
  };

  const onImportHTTP = async () => {
    const url = window.prompt("Paste HTTPS URL (text file OR JSON manifest):");
    if (!url) return;
    await ideStore.importFromHttp(url);
  };

  const filteredWorkspaces = useMemo(() => {
    const q = workspaceQuery.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.toLowerCase().includes(q));
  }, [workspaceQuery, workspaces]);

  async function handleWorkspaceAction(action: WorkspaceMenuAction) {
    setActiveMenuItem(action);

    try {
      if (action === "create") {
        const name = window.prompt("New workspace name:");
        if (name) await ideStore.createWorkspaceAndSwitch(name);
      }

      if (action === "backup") {
        await ideStore.backupCurrentWorkspace();
      }

      if (action === "restore") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = async () => {
          const f = input.files?.[0];
          if (f) await ideStore.restoreCurrentWorkspaceFromFile(f);
        };
        input.click();
      }

      if (action === "delete") {
        await ideStore.deleteCurrentWorkspace();
      }

      if (action === "rename") {
        const name = window.prompt("Rename workspace:", currentWorkspace);
        if (name) await ideStore.renameCurrentWorkspace(name);
      }

      if (action === "download") {
        await ideStore.downloadCurrentWorkspace();
      }

      if (action === "deleteAll") {
        await ideStore.deleteAllCurrentWorkspace();
      }

      if (action === "clone") {
        const repoUrl = window.prompt("Paste Git repo URL to clone into this workspace:");
        if (repoUrl) await ideStore.cloneRepo(repoUrl, currentWorkspace);
      }
    } finally {
      setMenuOpen(false);
      window.setTimeout(() => setActiveMenuItem(null), 180);
    }
  }

  const renderNode = (id: string) => {
    const node = nodes[id];
    if (!node) return null;

    const isFolder = node.type === "folder";
    const open = !!expanded[id];
    const isSelected = selectedId === id;

    const children = (node.childrenIds ?? [])
      .map((cid) => nodes[cid])
      .filter(Boolean)
      .sort((a, b) => Number(b.type === "folder") - Number(a.type === "folder") || a.name.localeCompare(b.name));

    return (
      <div
        key={id}
        className="treeNode"
        draggable={id !== rootId}
        onDragStart={(e) => e.dataTransfer.setData("text/node", id)}
        onDragOver={(e) => isFolder && e.preventDefault()}
        onDrop={(e) => {
          const dragged = e.dataTransfer.getData("text/node");
          if (dragged && dragged !== id) {
            ideStore.moveNode(dragged, isFolder ? id : node.parentId || rootId);
            setExpanded((x) => ({ ...x, [isFolder ? id : node.parentId || rootId]: true }));
          }
        }}
      >
        <div
          className={"treeRow" + (isSelected ? " selected" : "")}
          onClick={() => {
            setSelectedId(id);
            if (isFolder) {
              setExpanded((x) => ({ ...x, [id]: !x[id] }));
            } else {
              ideStore.openFile(id);
            }
          }}
        >
          <span className="treeTwisty" aria-hidden>
            {isFolder ? (open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />) : <span style={{ width: 14 }} />}
          </span>

          <span className="treeIcon" aria-hidden>
            {isFolder ? <IconFolder size={16} /> : <IconDoc size={16} />}
          </span>

          <span className="treeName">{node.name}</span>

          {id !== rootId && (
            <div className="treeActions">
              <button
                className="treeActBtn"
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation();
                  const n = prompt("Rename", node.name);
                  if (n) ideStore.renameNode(id, n);
                }}
              >
                ✎
              </button>
              <button
                className="treeActBtn"
                title="Duplicate"
                onClick={(e) => {
                  e.stopPropagation();
                  ideStore.duplicateNode(id);
                }}
              >
                ⧉
              </button>
              <button
                className="treeActBtn"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  ideStore.deleteNode(id);
                  setSelectedId((prev) => (prev === id ? rootId : prev));
                }}
              >
                🗑
              </button>
            </div>
          )}
        </div>

        {isFolder && open && <div className="treeChildren">{children.map((c) => renderNode(c.id))}</div>}
      </div>
    );
  };

  const recents = useIDEStore((s) => s.recentFiles);
  const recentItems = useMemo(
    () => recents.map((id) => ({ id, path: toPath(id, nodes) })).filter((x) => !!x.path),
    [nodes, recents]
  );

  const targetFolderId = resolveTargetFolderId();
  const targetFolderPath = toPath(targetFolderId, nodes) || "root";

  return (
    <div className="rxExplorer">
      <div className="rxExplorerHeader">
        <div className="rxExplorerTitleRow">
          <div className="rxWorkspaceHeaderLeft" ref={menuRef}>
            <button
              className={"rxWorkspaceMenuBtn" + (menuOpen ? " open" : "")}
              title="Workspace actions"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <IconWorkspaceMenu size={15} />
            </button>

            <div className="rxExplorerTitle">WORKSPACE</div>

            {menuOpen && (
              <div className="rxWorkspaceMenuDropdown">
                {WORKSPACE_MENU_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    className={"rxWorkspaceMenuItem" + (activeMenuItem === item.key ? " active" : "")}
                    onMouseEnter={() => setActiveMenuItem(item.key)}
                    onClick={() => handleWorkspaceAction(item.key)}
                  >
                    <span className="rxWorkspaceMenuIcon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="rxGitSignIn"
            onClick={() => ideStore.toast("GitHub Sign-in is a stub (wire OAuth later).")}
            title="GitHub Sign in"
          >
            Sign in
          </button>
        </div>

        <div className="rxWorkspaceBlock" ref={wsDropdownRef}>
          <div className="rxWorkspacePicker">
            <input
              className="homeSearchInput"
              placeholder="Search / switch workspace"
              value={workspaceQuery}
              onFocus={() => setWorkspaceDropdownOpen(true)}
              onChange={(e) => {
                setWorkspaceQuery(e.target.value);
                setWorkspaceDropdownOpen(true);
              }}
            />

            <button
              className="rxWorkspacePickerCaret"
              onClick={() => setWorkspaceDropdownOpen((v) => !v)}
              title="Show workspaces"
            >
              <IconChevronDown size={16} />
            </button>

            {workspaceDropdownOpen && (
              <div className="rxWorkspaceOptions">
                {filteredWorkspaces.length === 0 ? (
                  <div className="rxWorkspaceOptionEmpty">No workspaces found</div>
                ) : (
                  filteredWorkspaces.map((w) => {
                    const isCurrent = w === currentWorkspace;
                    return (
                      <button
                        key={w}
                        className={"rxWorkspaceOption" + (isCurrent ? " current" : "")}
                        onClick={async () => {
                          await ideStore.switchWorkspace(w);
                          setWorkspaceQuery("");
                          setWorkspaceDropdownOpen(false);
                        }}
                      >
                        <span className="rxWorkspaceOptionCheck">{isCurrent ? <IconCheck size={14} /> : <span style={{ width: 14 }} />}</span>
                        <span className="rxWorkspaceOptionText">{w}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="rxIconRow">
            <button className="rxIconBtn" title={`New file (inside: ${targetFolderPath})`} onClick={createNewFile}>
              <IconFile size={16} />
            </button>
            <button className="rxIconBtn" title={`New folder (inside: ${targetFolderPath})`} onClick={createNewFolder}>
              <IconFolder size={16} />
            </button>
            <button className="rxIconBtn" title="Open file from filesystem" onClick={onOpenFile}>
              <IconUploadFile size={16} />
            </button>
            <button className="rxIconBtn" title="Upload folder" onClick={onUploadFolder}>
              <IconUploadFolder size={16} />
            </button>
            <button className="rxIconBtn" title="Import from IPFS" onClick={onImportIPFS}>
              <IconIPFS size={16} />
            </button>
            <button className="rxIconBtn" title="Import from HTTPS" onClick={onImportHTTP}>
              <IconHTTP size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="rxTreeWrap">{renderNode(rootId)}</div>

      <div className="recentList">
        <h4>Recent Files</h4>
        {recentItems.length === 0 ? (
          <p className="empty">No recent files</p>
        ) : (
          recentItems.map((r) => (
            <button
              key={r.id}
              className="linkish"
              onClick={() => {
                setSelectedId(r.id);
                ideStore.openFile(r.id);
              }}
            >
              {r.path}
            </button>
          ))
        )}
      </div>
    </div>
  );
}