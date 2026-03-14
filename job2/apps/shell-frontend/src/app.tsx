import React, { useEffect, useMemo, useRef, useState } from "react";
import { CommandPalette } from "./components/commands/CommandPalette";
import { EditorTabs } from "./components/editor/EditorTabs";
import { ExplorerTree } from "./components/explorer/ExplorerTree";
import { BottomViews } from "./components/terminal/BottomViews";
import { HomePage } from "./components/home/HomePage.tsx";
import { LanguageSetupPage } from "./components/home/LanguageSetupPage";
import { ideStore, useIDEStore } from "./state/store";
import { MonacoEditor } from "./ui/MonacoEditor";
import { LanguageMode, StarterLanguage } from "./types";

const SETUP_STORAGE_KEY = "cardano.ide.language.setup.v1";

class PaletteErrorBoundary extends React.Component<
  { onError?: (err: unknown) => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function registerDefaultCommands() {
  const once = (id: string, title: string, handler: () => void, keybinding?: string) =>
    ideStore.registerCommand({ id, title, handler, keybinding });

  once(
    "file.new",
    "File: New File",
    () => {
      void ideStore.createNode("root", "file", "untitled.ts");
    },
    "Ctrl/Cmd+N"
  );

  once("file.newFolder", "File: New Folder", () => {
    void ideStore.createNode("root", "folder", "folder");
  });

  once("file.rename", "File: Rename", () => ideStore.toast("Use rename icon in explorer"));
  once("file.delete", "File: Delete", () => ideStore.toast("Use delete icon in explorer"));

  once(
    "file.save",
    "File: Save",
    () => {
      const active = ideStore.getState().activeTabId;
      if (active) void ideStore.saveFile(active);
    },
    "Ctrl/Cmd+S"
  );

  once(
    "file.saveAll",
    "File: Save All",
    () => {
      void ideStore.saveAll();
    },
    "Ctrl/Cmd+Alt+S"
  );

  once("editor.openFile", "Editor: Open File", () => ideStore.toast("Open file from explorer/quick open"));

  once(
    "editor.closeTab",
    "Editor: Close Tab",
    () => {
      const active = ideStore.getState().activeTabId;
      if (active) ideStore.closeTab(active);
    },
    "Ctrl/Cmd+W"
  );

  once("editor.splitVertical", "Editor: Split Vertical", () => ideStore.setSplitOrientation("vertical"));
  once("editor.splitHorizontal", "Editor: Split Horizontal", () => ideStore.setSplitOrientation("horizontal"));
  once("view.toggleTerminal", "View: Toggle Terminal", () => ideStore.toggleBottomPanel());
  once("view.toggleSidePanel", "View: Toggle Side Panel", () => ideStore.toggleSidePanel());
  once("view.toggleTheme", "View: Toggle Theme", () => ideStore.toggleTheme());
  once("workspace.export", "Workspace: Export", () => ideStore.exportWorkspace());
  once("workspace.import", "Workspace: Import", () => document.getElementById("workspace-import")?.click());
  once("workspace.reset", "Workspace: Reset", () => ideStore.resetWorkspace());
  once("editor.reopenClosedTab", "Editor: Reopen Closed Tab", () => ideStore.reopenClosedTab(), "Ctrl/Cmd+Shift+T");
  once("editor.format", "Editor: Format Document", () => ideStore.toast("Formatting hook executed"));

  once(
    "build.compileActive",
    "Build: Compile Active File",
    () => {
      void ideStore.compileActiveFile();
    },
    "Ctrl/Cmd+B"
  );
}

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11 12 3l9 8v10H3V11Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );

    case "compile":
      return (
        <svg {...common}>
          <path d="M8 7h8M8 12h8M8 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 4h16v16H4V4Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );

    case "terminal":
      return (
        <svg {...common}>
          <path d="M4 6h16v12H4V6Z" stroke="currentColor" strokeWidth="2" />
          <path d="M7 10l2 2-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "wallet":
      return (
        <svg {...common}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v2h-5a2.5 2.5 0 0 0 0 5H20v3a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" strokeWidth="2" />
          <path d="M20 10h-5a1.5 1.5 0 0 0 0 3h5v-3Z" stroke="currentColor" strokeWidth="2" />
          <circle cx="15.5" cy="11.5" r="0.8" fill="currentColor" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <path
            d="M12 3.5 13.8 5l2.3-.4 1 2.1 2.2.9-.4 2.3L20.5 12 19 13.8l.4 2.3-2.1 1-1 2.2-2.3-.4L12 20.5 10.2 19l-2.3.4-1-2.1-2.2-1 .4-2.3L3.5 12 5 10.2l-.4-2.3 2.1-1 1-2.2 2.3.4L12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );

    case "theme":
      return (
        <svg {...common}>
          <path d="M20 14.5A7.5 7.5 0 1 1 9.5 4 6 6 0 0 0 20 14.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );

    case "palette":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M7 10h2M11 10h2M15 10h2M7 14h5M14 14h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "explorer":
      return (
        <svg {...common}>
          <path
            d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
          <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "source":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.2" stroke="currentColor" strokeWidth="2" />
          <circle cx="18" cy="6" r="2.2" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="18" r="2.2" stroke="currentColor" strokeWidth="2" />
          <path d="M8 7.3 10.5 9.5M16 7.3 13.5 9.5M12 15.8v-4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "tests":
      return (
        <svg {...common}>
          <path d="M9 3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 3v4l-4.8 8.2A3 3 0 0 0 7.8 20h8.4a3 3 0 0 0 2.6-4.8L14 7V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "extensions":
      return (
        <svg {...common}>
          <path
            d="M12 3.5 15 6.5 13.3 8.2 15.8 10.7 17.5 9l3 3-3 3-1.7-1.7-2.5 2.5 1.7 1.7-3 3-3-3 1.7-1.7-2.5-2.5L6.5 15l-3-3 3-3 1.7 1.7 2.5-2.5L9 6.5l3-3Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
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

const ACTIVITY_ITEMS = [
  { id: "explorer", icon: "explorer", title: "Explorer" },
  { id: "search", icon: "search", title: "Search" },
  { id: "source", icon: "source", title: "Source Control" },
  { id: "tests", icon: "tests", title: "Tests" },
  { id: "extensions", icon: "extensions", title: "Extensions" },
] as const;

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQ, setQuickQ] = useState("");
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoLine, setGotoLine] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<"setup" | "home" | "editor">(() => {
    if (typeof window === "undefined") return "setup";
    return window.localStorage.getItem(SETUP_STORAGE_KEY) ? "home" : "setup";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const bootRef = useRef(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  const state = useIDEStore((s) => s);
  const workspaces = useIDEStore((s) => s.workspaces);
  const currentWorkspace = useIDEStore((s) => s.currentWorkspace);
  const activeTab = state.openTabs.find((t) => t.id === state.activeTabId) ?? null;
  const activeNode = activeTab ? state.nodes[activeTab.nodeId] : null;

  useEffect(() => {
    registerDefaultCommands();
    void ideStore.initWorkspaceSystem();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;

      if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (meta && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuickOpen(true);
        return;
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        ideStore.executeCommand("file.save");
        return;
      }
      if (meta && e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        ideStore.executeCommand("file.saveAll");
        return;
      }
      if (meta && e.key.toLowerCase() === "w") {
        e.preventDefault();
        ideStore.executeCommand("editor.closeTab");
        return;
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        ideStore.executeCommand("editor.reopenClosedTab");
        return;
      }
      if (meta && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGotoOpen(true);
        return;
      }
      if (meta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        ideStore.executeCommand("view.toggleTerminal");
        return;
      }
      if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        void ideStore.compileActiveFile();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!bootRef.current) {
      bootRef.current = true;
      return;
    }
    if (state.activeTabId) setActiveView("editor");
  }, [state.activeTabId]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!settingsRef.current) return;
      if (!settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const searchResults = useMemo(() => (search ? ideStore.searchInFiles(search) : []), [search, state.nodes]);

  const quickItems = useMemo(
    () => Object.values(state.nodes).filter((n) => n.type === "file" && n.name.toLowerCase().includes(quickQ.toLowerCase())),
    [quickQ, state.nodes]
  );

  const splitClass =
    state.layout.splitOrientation === "vertical"
      ? "split-vertical"
      : state.layout.splitOrientation === "horizontal"
      ? "split-horizontal"
      : "split-none";

  const onCompile = async () => {
    const ok = await ideStore.compileActiveFile();
    if (ok) setActiveView("editor");
  };

  const handlePlutusStarter = async () => {
    const nodeId = await ideStore.createTemplateFile("plutus-starter");
    if (nodeId) setActiveView("editor");
  };

  const handleMintingPolicy = async () => {
    const nodeId = await ideStore.createTemplateFile("minting-policy");
    if (nodeId) setActiveView("editor");
  };

  const handleValidatorScript = async () => {
    const nodeId = await ideStore.createTemplateFile("validator-script");
    if (nodeId) setActiveView("editor");
  };

  const handleLanguageStarter = async (language: StarterLanguage) => {
    const nodeId = await ideStore.createLanguageStarter(language);
    if (nodeId) {
      window.localStorage.setItem(SETUP_STORAGE_KEY, language);
      setActiveView("editor");
    }
  };

  const handleSkipSetup = () => {
    window.localStorage.setItem(SETUP_STORAGE_KEY, "skipped");
    setActiveView("home");
  };

  return (
    <div className={`app ${state.theme} ${state.layout.showBottomPanel ? "terminal-open" : "terminal-hidden"}`}>
      <input
        id="workspace-import"
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) ideStore.importWorkspace(f);
        }}
      />

      <header className="topbar">
        <div className="brand">Cardano IDE</div>

        <div className="topbarMid">
          <button
            className="topIconBtn"
            title="Home"
            onClick={() => {
              setActiveView("home");
            }}
          >
            <Icon name="home" />
            <span>Home</span>
          </button>

          <button
            className="topIconBtn"
            title="Starter Templates"
            onClick={() => {
              setActiveView("setup");
            }}
          >
            <Icon name="extensions" />
            <span>Templates</span>
          </button>
        </div>

        <select
          className="workspaceSelectTop"
          value={currentWorkspace}
          onChange={(e) => {
            void ideStore.switchWorkspace(e.target.value);
          }}
        >
          {workspaces.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <div className="topbarActions">
          <button className="btnGhost walletBtn" title="Connect Wallet (CIP-30)">
            <Icon name="wallet" />
            <span>Connect Wallet</span>
          </button>

          <button className="btnPrimary" onClick={onCompile}>
            Compile
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="activityBar">
          <div className="activityBarMain">
            {ACTIVITY_ITEMS.map((a) => (
              <button
                key={a.id}
                className={state.activity === a.id ? "active activityBtn" : "activityBtn"}
                onClick={() => ideStore.setActivity(a.id)}
                title={a.title}
                aria-label={a.title}
              >
                <Icon name={a.icon} />
              </button>
            ))}
          </div>

          <div className="activityBarBottom" ref={settingsRef}>
            <button
              className={settingsOpen ? "activityBtn settingsBtn active" : "activityBtn settingsBtn"}
              onClick={() => setSettingsOpen((v) => !v)}
              title="Settings"
              aria-label="Settings"
            >
              <Icon name="settings" />
            </button>

            {settingsOpen && (
              <div className="settingsMenu">
                <button
                  className="settingsMenuItem"
                  onClick={() => {
                    ideStore.executeCommand("view.toggleTheme");
                    setSettingsOpen(false);
                  }}
                >
                  <span className="settingsMenuIcon">
                    <Icon name="theme" />
                  </span>
                  <span>Theme</span>
                </button>

                <button
                  className="settingsMenuItem"
                  onClick={() => {
                    setPaletteOpen(true);
                    setSettingsOpen(false);
                  }}
                >
                  <span className="settingsMenuIcon">
                    <Icon name="palette" />
                  </span>
                  <span>Command Palette</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {state.layout.showSidePanel && (
          <aside className="sidePanel" style={{ width: state.layout.sideWidth }}>
            <div className="panelTitle">{state.activity.toUpperCase()}</div>

            {state.activity === "explorer" && <ExplorerTree />}

            {state.activity === "search" && (
              <div>
                <input placeholder="Search in files" value={search} onChange={(e) => setSearch(e.target.value)} />
                {searchResults.map((r) => (
                  <button key={r.nodeId} className="searchItem" onClick={() => ideStore.openFile(r.nodeId)}>
                    {r.path}: {r.preview}
                  </button>
                ))}
              </div>
            )}

            {state.activity !== "explorer" && state.activity !== "search" && (
              <div className="empty">{state.activity} panel (stub)</div>
            )}
          </aside>
        )}

        {state.layout.showSidePanel && (
          <div
            className="resizeX"
            onMouseDown={(e) => {
              const start = e.clientX;
              const initial = state.layout.sideWidth;
              const move = (me: MouseEvent) => ideStore.resizeSidePanel(initial + (me.clientX - start));
              const up = () => {
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
              };
              window.addEventListener("mousemove", move);
              window.addEventListener("mouseup", up);
            }}
          />
        )}

        <main className={`main ${splitClass}`}>
          <div className={"stageShell" + (activeView === "editor" ? " isEditor" : " isHome")}>
            {activeView === "setup" ? (
              <div className="mainStage homeStage">
                <LanguageSetupPage onCreateStarter={handleLanguageStarter} onSkip={handleSkipSetup} />
              </div>
            ) : activeView === "home" ? (
              <div className="mainStage homeStage">
                <HomePage
                  onStartCoding={() => setActiveView("editor")}
                  onPlutusStarter={handlePlutusStarter}
                  onMintingPolicy={handleMintingPolicy}
                  onValidatorScript={handleValidatorScript}
                  onOpenLanguageSetup={() => setActiveView("setup")}
                />
              </div>
            ) : (
              <>
                <div className="editorPane">
                  <EditorTabs splitId="primary" />
                  <div className="breadcrumbs">{activeTab?.path ?? "No file selected"}</div>

                  {activeNode ? (
                    <MonacoEditor
                      value={activeNode.content ?? ""}
                      language={activeNode.language ?? "plaintext"}
                      theme={state.theme}
                      onCursor={(line, column) => ideStore.setCursor(line, column)}
                      gotoLine={gotoLine}
                      onChange={(v) => activeTab && ideStore.updateContent(activeTab.id, v)}
                    />
                  ) : (
                    <div className="empty">Open a file from Explorer or Quick Open (Ctrl/Cmd+P).</div>
                  )}
                </div>

                {state.layout.splitOrientation !== "none" && (
                  <div className="editorPane secondary">
                    <EditorTabs splitId="primary" />
                    <div className="empty">
                      Secondary split view (mirrored active tab).{" "}
                      <button onClick={() => ideStore.setSplitOrientation("none")}>Close split</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!state.layout.showBottomPanel && (
            <div className="bottomCollapsed">
              <button className="bottomCollapsedBtn" onClick={() => ideStore.executeCommand("view.toggleTerminal")}>
                <Icon name="terminal" /> Show Terminal
              </button>
            </div>
          )}

          {state.layout.showBottomPanel && (
            <>
              <div
                className="resizeY"
                title="Drag to resize terminal"
                onMouseDown={(e) => {
                  const start = e.clientY;
                  const initial = state.layout.bottomHeight;
                  const move = (me: MouseEvent) => ideStore.resizeBottomPanel(initial - (me.clientY - start));
                  const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                  };
                  window.addEventListener("mousemove", move);
                  window.addEventListener("mouseup", up);
                }}
              >
                <div className="resizeYGrip" />
              </div>

              <section className="bottomPanel" style={{ height: state.layout.bottomHeight }}>
                <BottomViews />
              </section>
            </>
          )}
        </main>
      </div>

      <footer className="statusbar">
        <span>
          Ln {state.cursor.line}, Col {state.cursor.column}
        </span>

        <select
          value={activeNode?.language ?? state.activeLanguage}
          onChange={(e) => activeTab && ideStore.setLanguage(activeTab.id, e.target.value as LanguageMode)}
        >
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
          <option value="json">JSON</option>
          <option value="markdown">Markdown</option>
          <option value="haskell">Haskell</option>
          <option value="python">Python</option>
          <option value="plaintext">Plain Text</option>
        </select>

        <span>{state.settings.lineEnding}</span>
        <span>{state.settings.insertSpaces ? `Spaces: ${state.settings.tabSize}` : "Tabs"}</span>
        <span>Branch: {state.branch}</span>
      </footer>

      {paletteOpen && (
        <PaletteErrorBoundary
          onError={(err) => {
            console.error("[CommandPalette crashed]", err);
            ideStore.toast("Command palette crashed. Fix CommandPalette.tsx snapshot.");
            setPaletteOpen(false);
          }}
        >
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </PaletteErrorBoundary>
      )}

      {quickOpen && (
        <div className="overlay" onClick={() => setQuickOpen(false)}>
          <div className="palette" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              className="paletteInput"
              placeholder="Quick Open"
              value={quickQ}
              onChange={(e) => setQuickQ(e.target.value)}
            />
            {quickItems.map((f) => (
              <button
                key={f.id}
                className="paletteItem"
                onClick={() => {
                  ideStore.openFile(f.id);
                  setQuickOpen(false);
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {gotoOpen && (
        <div className="overlay" onClick={() => setGotoOpen(false)}>
          <div className="goto" onClick={(e) => e.stopPropagation()}>
            <p>Go to line</p>
            <input
              autoFocus
              type="number"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setGotoLine(Number((e.target as HTMLInputElement).value));
                  setGotoOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="toasts">
        {state.toasts.map((t) => (
          <div className={`toast ${t.kind}`} key={t.id}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}