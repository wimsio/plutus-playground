import React, { useMemo, useRef, useState, useEffect } from "react";
import { ideStore, useIDEStore } from "../../state/store";

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const };
  switch (name) {
    case "search":
      return (
        <svg {...common}>
          <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
          <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
}

type DocSearchResult =
  | { kind: "doc"; item: { id: string; title: string; url: string; keywords: string[] } }
  | { kind: "local"; nodeId: string; title: string; path: string; preview: string };

export function HomePage({
  onStartCoding,
  onPlutusStarter,
  onMintingPolicy,
  onValidatorScript,
  onOpenLanguageSetup,
}: {
  onStartCoding: () => void;
  onPlutusStarter: () => void;
  onMintingPolicy: () => void;
  onValidatorScript: () => void;
  onOpenLanguageSetup: () => void;
}) {
  const workspaces = useIDEStore((s) => s.workspaces);
  const currentWorkspace = useIDEStore((s) => s.currentWorkspace);

  useEffect(() => {
    void ideStore.initWorkspaceSystem();
  }, []);

  const onNew = async () => {
    await ideStore.createNode("root", "file", "untitled.ts");
    onStartCoding();
  };

  const onOpen = async () => {
    const ok = await ideStore.openFromFilePicker();
    if (ok) onStartCoding();
  };

  const onGist = async () => {
    const idOrUrl = window.prompt("Paste GitHub Gist URL or Gist ID:");
    if (!idOrUrl) return;
    const ok = await ideStore.importFromGist(idOrUrl);
    if (ok) onStartCoding();
  };

  const onClone = async () => {
    const repoUrl = window.prompt("Paste Git repo URL to clone:");
    if (!repoUrl) return;
    const ok = await ideStore.cloneRepo(repoUrl, currentWorkspace);
    if (ok) onStartCoding();
  };

  const onConnectLocal = async () => {
    const ok = await ideStore.connectLocalFilesystem();
    if (ok) onStartCoding();
  };

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const query = q.trim();
    if (!query) return [] as DocSearchResult[];
    return ideStore.searchDocumentation(query) as DocSearchResult[];
  }, [q]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const onSearchClick = () => {
    if (!q.trim()) return;
    setOpen(true);
    if (!results.length) ideStore.toast("No results.");
  };

  const onPick = (r: DocSearchResult) => {
    if (r.kind === "doc") {
      ideStore.openDocumentationUrl(r.item.url);
      ideStore.toast(`Opened docs: ${r.item.title}`);
      setOpen(false);
      return;
    }
    ideStore.openFile(r.nodeId);
    onStartCoding();
    setOpen(false);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter") {
      e.preventDefault();
      onSearchClick();
    }
  };

  return (
    <div className="homeWrap">
      <div className="homeTitle">CARDANO IDE</div>

      <div ref={wrapRef} className="homeSearchWrap">
        <div className="homeSearch">
          <input
            className="homeSearchInput"
            placeholder="Search Documentation"
            value={q}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              setOpen(!!v.trim());
            }}
            onFocus={() => {
              if (q.trim()) setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          <button className="homeSearchBtn" title="Search" onClick={onSearchClick}>
            <Icon name="search" />
          </button>
        </div>

        {open && q.trim() && (
          <div className="docDropdown" role="listbox">
            {results.length === 0 ? (
              <div className="docEmpty">No results</div>
            ) : (
              <>
                <div className="docGroupLabel">Documentation</div>
                {results
                  .filter((r) => r.kind === "doc")
                  .slice(0, 6)
                  .map((r) => {
                    const doc = (r as any).item;
                    return (
                      <button key={`doc-${doc.id}`} className="docItem" onClick={() => onPick(r)}>
                        <div className="docTitle">{doc.title}</div>
                        <div className="docMeta">{doc.url}</div>
                      </button>
                    );
                  })}

                <div className="docGroupLabel">Workspace</div>
                {results
                  .filter((r) => r.kind === "local")
                  .slice(0, 6)
                  .map((r: any) => (
                    <button key={`local-${r.nodeId}-${r.path}`} className="docItem" onClick={() => onPick(r)}>
                      <div className="docTitle">{r.title}</div>
                      <div className="docMeta">{r.preview || r.path}</div>
                    </button>
                  ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="homeSub">Explore. Prototype. Build on Cardano.</div>

      <div className="homePills">
        <button className="pill primary" onClick={onStartCoding}>
          Start Coding
        </button>
        <button className="pill" onClick={onOpenLanguageSetup}>
          Language Templates
        </button>
        <button className="pill" onClick={onPlutusStarter}>
          Plutus Starter
        </button>
        <button className="pill" onClick={onMintingPolicy}>
          Minting Policy
        </button>
        <button className="pill" onClick={onValidatorScript}>
          Validator Script
        </button>
      </div>

      <div className="homeSection">
        <div className="homeSectionTitle">Recent Workspaces</div>
        <div className="homeLinks">
          {workspaces.length === 0 ? (
            <span className="empty">No workspaces</span>
          ) : (
            workspaces.slice(0, 8).map((w) => (
              <a
                key={w}
                className="homeLink"
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  await ideStore.switchWorkspace(w);
                  onStartCoding();
                }}
              >
                {w}
              </a>
            ))
          )}
        </div>
      </div>

      <div className="homeSection">
        <div className="homeSectionTitle">Files</div>
        <div className="homeFileBtns">
          <button className="fileBtn" onClick={onNew}>
            <span className="fileBtnIcon">📄</span>New
          </button>
          <button className="fileBtn" onClick={onOpen}>
            <span className="fileBtnIcon">⬆️</span>Open
          </button>
          <button className="fileBtn" onClick={onGist}>
            <span className="fileBtnIcon">🐙</span>Gist
          </button>
          <button className="fileBtn" onClick={onClone}>
            <span className="fileBtnIcon">🔗</span>Clone
          </button>
          <button className="fileBtn wide" onClick={onConnectLocal}>
            <span className="fileBtnIcon">🖥️</span>Connect to Local Filesystem
          </button>
        </div>
      </div>
    </div>
  );
}