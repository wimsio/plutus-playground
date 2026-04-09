import { useSyncExternalStore } from "react";
import {
  Command,
  Diagnostic,
  EditorSplit,
  OpenTab,
  WorkspaceNode,
  ActivityView,
  BottomView,
  LanguageMode,
  StarterLanguage,
} from "../types";
import { setFileAtPath, type ImportedFile } from "../workspace/importers.ts";
import { parseGistId, fetchGistFiles } from "../workspace/gist.ts";
import { connectDirectoryPicker, readDirectoryAsFiles } from "../workspace/localFs.ts";
import {
  startCompile,
  streamUrl,
  wsClone,
  workspacesList,
  workspacesCreate,
  workspacesRename,
  workspacesDelete,
  workspacesDeleteAll,
  workspacesBackup,
  workspacesRestore,
  workspacesDownload,
  wsTree,
  wsRead,
  wsWrite,
  wsMkdir,
  wsTouch,
  wsDelete,
  wsRename,
} from "../core/api.ts";
import { searchDocs } from "../docs/searchDocs.ts";
import { importFromHttpUrl } from "../workspace/httpImport.ts";
import { pickFolderAsFiles } from "../workspace/folderPicker.ts";
import { importFromIpfsRef } from "../workspace/ipfsImport.ts";
import { buildLanguageStarterTemplate, type TemplateFile } from "../templates/languageStarterRegistry.ts";

const STORAGE_KEY = "cardano.ide.workspace.v1";

type Toast = { id: string; message: string; kind: "info" | "error" };

type Layout = {
  sideWidth: number;
  bottomHeight: number;
  showSidePanel: boolean;
  showBottomPanel: boolean;
  splitOrientation: "none" | "vertical" | "horizontal";
};

type WorkspaceTreeItem = {
  type: "dir" | "file";
  name: string;
  path: string;
  children?: WorkspaceTreeItem[];
};

type State = {
  nodes: Record<string, WorkspaceNode>;
  rootId: string;
  openTabs: OpenTab[];
  activeTabId: string | null;
  dirty: Record<string, boolean>;
  recentFiles: string[];
  closedTabStack: OpenTab[];
  activity: ActivityView;
  bottomView: BottomView;
  layout: Layout;
  theme: "dark" | "light";
  settings: { tabSize: number; lineEnding: "LF" | "CRLF"; insertSpaces: boolean };
  diagnostics: Diagnostic[];
  outputLines: string[];
  terminalLines: string[];
  terminalInput: string;
  branch: string;
  cursor: { line: number; column: number };
  activeLanguage: LanguageMode;
  splits: EditorSplit[];
  toasts: Toast[];
  commands: Record<string, Command>;
  currentWorkspace: string;
  workspaces: string[];
};

type CardanoTemplateKind = "plutus-starter" | "minting-policy" | "validator-script";

function makePersistableState(state: State) {
  const nodes = Object.fromEntries(
    Object.entries(state.nodes).map(([id, n]) => {
      if (n?.type === "file") return [id, { ...n, content: "" }];
      return [id, n];
    })
  );

  return {
    ...state,
    nodes,
    terminalLines: state.terminalLines.slice(-200),
    outputLines: state.outputLines.slice(-800),
    diagnostics: state.diagnostics,
    toasts: [],
  };
}

const uid = () => Math.random().toString(36).slice(2, 9);

function pathOf(id: string, nodes: Record<string, WorkspaceNode>): string {
  const chunks: string[] = [];
  let cur: WorkspaceNode | undefined = nodes[id];
  while (cur && cur.parentId) {
    chunks.unshift(cur.name);
    cur = nodes[cur.parentId];
  }
  return chunks.join("/");
}

function detectLanguage(name: string): LanguageMode {
  const lower = name.toLowerCase();

  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".php")) return "php";
  if (lower.endsWith(".hs")) return "haskell";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".cbor")) return "plaintext";
  if (lower.endsWith(".ak")) return "plaintext";
  if (lower.endsWith(".hl")) return "plaintext";
  if (lower.endsWith(".compact")) return "plaintext";
  if (lower.endsWith(".mid")) return "plaintext";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".sql")) return "sql";

  return "plaintext";
}

function createEmptyNodes(workspaceName = "default_workspace"): Record<string, WorkspaceNode> {
  const rootId = "root";
  return {
    [rootId]: {
      id: rootId,
      name: workspaceName,
      type: "folder",
      parentId: null,
      childrenIds: [],
    },
  };
}

function createInitialState(): State {
  const rootId = "root";
  return {
    nodes: createEmptyNodes("default_workspace"),
    rootId,
    openTabs: [],
    activeTabId: null,
    dirty: {},
    recentFiles: [],
    closedTabStack: [],
    activity: "explorer",
    bottomView: "terminal",
    layout: { sideWidth: 280, bottomHeight: 190, showSidePanel: true, showBottomPanel: true, splitOrientation: "none" },
    theme: "dark",
    settings: { tabSize: 2, lineEnding: "LF", insertSpaces: true },
    diagnostics: [],
    outputLines: ["[output] Cardano IDE initialized"],
    terminalLines: ["cardano@ide:$ welcome"],
    terminalInput: "",
    branch: "main",
    cursor: { line: 1, column: 1 },
    activeLanguage: "typescript",
    splits: [{ id: "primary", tabIds: [], activeTabId: null }],
    toasts: [],
    commands: {},
    currentWorkspace: "default_workspace",
    workspaces: ["default_workspace"],
  };
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const persisted = JSON.parse(raw) as Partial<State>;
    const base = createInitialState();
    const merged: State = { ...base, ...persisted } as State;
    return {
      ...merged,
      openTabs: [],
      activeTabId: null,
      splits: merged.splits?.map((sp) => ({ ...sp, tabIds: [], activeTabId: null })) ?? [
        { id: "primary", tabIds: [], activeTabId: null },
      ],
    };
  } catch {
    return createInitialState();
  }
}

function nodeIdFor(type: "dir" | "file", path: string) {
  return `${type}:${path}`;
}

function buildNodesFromTree(items: WorkspaceTreeItem[], workspaceName: string): Record<string, WorkspaceNode> {
  const rootId = "root";
  const nodes: Record<string, WorkspaceNode> = {
    [rootId]: {
      id: rootId,
      name: workspaceName,
      type: "folder",
      parentId: null,
      childrenIds: [],
    },
  };

  function addItem(item: WorkspaceTreeItem, parentId: string) {
    const isFolder = item.type === "dir";
    const id = nodeIdFor(item.type, item.path);

    nodes[id] = {
      id,
      name: item.name,
      type: isFolder ? "folder" : "file",
      parentId,
      childrenIds: isFolder ? [] : undefined,
      content: isFolder ? undefined : "",
      language: isFolder ? undefined : detectLanguage(item.name),
    };

    nodes[parentId].childrenIds = [...(nodes[parentId].childrenIds ?? []), id];

    if (isFolder) {
      for (const child of item.children ?? []) addItem(child, id);
    }
  }

  for (const item of items) addItem(item, rootId);
  return nodes;
}

function plutusStarterScaffold(folder: string): TemplateFile[] {
  return [
    {
      path: `${folder}/README.md`,
      content: `# ${folder}

This is a Plutus starter workspace scaffold.

Expected compile behavior in this IDE:
1. Save your Haskell/Plutus files
2. Click Compile
3. IDE runs cabal build in this project
4. IDE runs export executables found inside app/
5. Generated artifacts are written to artifacts/

Replace the sample source with real Plutus validator/policy export code when ready.
`,
    },
    {
      path: `${folder}/cabal.project`,
      content: `packages: .
`,
    },
    {
      path: `${folder}/${folder}.cabal`,
      content: `cabal-version:      3.0
name:               ${folder}
version:            0.1.0.0
build-type:         Simple

common shared
  default-language: GHC2021
  ghc-options:      -Wall
  hs-source-dirs:   src
  build-depends:
      base >=4.14 && <5

library
  import:           shared
  exposed-modules:  Validator

executable export-validator
  default-language: GHC2021
  main-is:          export-validator.hs
  hs-source-dirs:   app, src
  build-depends:
      base >=4.14 && <5,
      ${folder}

executable export-policy
  default-language: GHC2021
  main-is:          export-policy.hs
  hs-source-dirs:   app, src
  build-depends:
      base >=4.14 && <5,
      ${folder}
`,
    },
    {
      path: `${folder}/src/Validator.hs`,
      content: `module Validator where

validatorName :: String
validatorName = "Sample Validator"

validatorCborHex :: String
validatorCborHex = "4e4d01000033222220051200120011"

policyName :: String
policyName = "Sample Minting Policy"

policyCborHex :: String
policyCborHex = "4e4d01000033222220051200120022"
`,
    },
    {
      path: `${folder}/app/export-validator.hs`,
      content: `module Main where

import System.Directory (createDirectoryIfMissing)
import System.FilePath ((</>))
import Validator

main :: IO ()
main = do
  createDirectoryIfMissing True "artifacts"
  writeFile ("artifacts" </> "validator.plutus") validatorName
  writeFile ("artifacts" </> "validator.cbor") validatorCborHex
  writeFile ("artifacts" </> "validator.script") validatorCborHex
  putStrLn "validator artifacts written"
`,
    },
    {
      path: `${folder}/app/export-policy.hs`,
      content: `module Main where

import System.Directory (createDirectoryIfMissing)
import System.FilePath ((</>))
import Validator

main :: IO ()
main = do
  createDirectoryIfMissing True "artifacts"
  writeFile ("artifacts" </> "policy.plutus") policyName
  writeFile ("artifacts" </> "policy.cbor") policyCborHex
  writeFile ("artifacts" </> "policy.script") policyCborHex
  putStrLn "policy artifacts written"
`,
    },
  ];
}

function mintingPolicyScaffold(folder: string): TemplateFile[] {
  return [
    {
      path: `${folder}/README.md`,
      content: `# ${folder}

Minting policy scaffold.
Compile generates artifacts into artifacts/.
`,
    },
    {
      path: `${folder}/cabal.project`,
      content: `packages: .
`,
    },
    {
      path: `${folder}/${folder}.cabal`,
      content: `cabal-version:      3.0
name:               ${folder}
version:            0.1.0.0
build-type:         Simple

common shared
  default-language: GHC2021
  ghc-options:      -Wall
  hs-source-dirs:   src
  build-depends:
      base >=4.14 && <5

library
  import:           shared
  exposed-modules:  MintingPolicy

executable export-policy
  default-language: GHC2021
  main-is:          export-policy.hs
  hs-source-dirs:   app, src
  build-depends:
      base >=4.14 && <5,
      ${folder}
`,
    },
    {
      path: `${folder}/src/MintingPolicy.hs`,
      content: `module MintingPolicy where

policyName :: String
policyName = "Sample Minting Policy"

policyCborHex :: String
policyCborHex = "4e4d01000033222220051200120033"
`,
    },
    {
      path: `${folder}/app/export-policy.hs`,
      content: `module Main where

import System.Directory (createDirectoryIfMissing)
import System.FilePath ((</>))
import MintingPolicy

main :: IO ()
main = do
  createDirectoryIfMissing True "artifacts"
  writeFile ("artifacts" </> "policy.plutus") policyName
  writeFile ("artifacts" </> "policy.cbor") policyCborHex
  writeFile ("artifacts" </> "policy.script") policyCborHex
  putStrLn "policy artifacts written"
`,
    },
  ];
}

function validatorScriptScaffold(folder: string): TemplateFile[] {
  return [
    {
      path: `${folder}/README.md`,
      content: `# ${folder}

Validator script scaffold.
Compile generates artifacts into artifacts/.
`,
    },
    {
      path: `${folder}/cabal.project`,
      content: `packages: .
`,
    },
    {
      path: `${folder}/${folder}.cabal`,
      content: `cabal-version:      3.0
name:               ${folder}
version:            0.1.0.0
build-type:         Simple

common shared
  default-language: GHC2021
  ghc-options:      -Wall
  hs-source-dirs:   src
  build-depends:
      base >=4.14 && <5

library
  import:           shared
  exposed-modules:  ScriptValidator

executable export-validator
  default-language: GHC2021
  main-is:          export-validator.hs
  hs-source-dirs:   app, src
  build-depends:
      base >=4.14 && <5,
      ${folder}
`,
    },
    {
      path: `${folder}/src/ScriptValidator.hs`,
      content: `module ScriptValidator where

scriptName :: String
scriptName = "Sample Spending Validator"

scriptCborHex :: String
scriptCborHex = "4e4d01000033222220051200120044"
`,
    },
    {
      path: `${folder}/app/export-validator.hs`,
      content: `module Main where

import System.Directory (createDirectoryIfMissing)
import System.FilePath ((</>))
import ScriptValidator

main :: IO ()
main = do
  createDirectoryIfMissing True "artifacts"
  writeFile ("artifacts" </> "validator.plutus") scriptName
  writeFile ("artifacts" </> "validator.cbor") scriptCborHex
  writeFile ("artifacts" </> "validator.script") scriptCborHex
  putStrLn "validator artifacts written"
`,
    },
  ];
}

class IDEStore {
  private state: State = loadState();
  private listeners = new Set<() => void>();
  private bootstrapped = false;
  private loadingFileIds = new Set<string>();
  private compileStream: EventSource | null = null;

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getState = () => this.state;

  private setState = (updater: (s: State) => State) => {
    this.state = updater(this.state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(makePersistableState(this.state)));
    } catch (e) {
      console.warn("[persist] Failed to save workspace", e);
    }
    this.listeners.forEach((l) => l());
  };

  private closeCompileStream() {
    if (this.compileStream) {
      this.compileStream.close();
      this.compileStream = null;
    }
  }

  private pushOutputLine(line: string) {
    this.setState((s) => ({
      ...s,
      outputLines: [...s.outputLines, line].slice(-800),
      layout: { ...s.layout, showBottomPanel: true },
      bottomView: "output",
    }));
  }

  private async refreshWorkspaceTreePreservingOpenTabs() {
    const project = this.state.currentWorkspace;
    const res = await wsTree(project, "");
    const freshNodes = buildNodesFromTree((res.items ?? []) as WorkspaceTreeItem[], project);

    this.setState((s) => {
      const openNodeIds = new Set(s.openTabs.map((t) => t.nodeId));
      const mergedNodes: Record<string, WorkspaceNode> = {};

      for (const [id, fresh] of Object.entries(freshNodes)) {
        const prev = s.nodes[id];
        if (openNodeIds.has(id) && prev?.type === "file" && fresh.type === "file") {
          mergedNodes[id] = {
            ...fresh,
            content: prev.content ?? "",
            language: prev.language ?? fresh.language,
          };
        } else {
          mergedNodes[id] = fresh;
        }
      }

      const openTabs = s.openTabs.filter((t) => mergedNodes[t.nodeId]);
      const activeTabId = openTabs.some((t) => t.id === s.activeTabId) ? s.activeTabId : openTabs[0]?.id ?? null;
      const dirty = Object.fromEntries(Object.entries(s.dirty).filter(([nodeId]) => !!mergedNodes[nodeId]));
      const splits = s.splits.map((sp) => {
        const validTabIds = sp.tabIds.filter((id) => openTabs.some((t) => t.id === id));
        const activeSplitTabId =
          sp.activeTabId && validTabIds.includes(sp.activeTabId) ? sp.activeTabId : validTabIds[0] ?? null;
        return { ...sp, tabIds: validTabIds, activeTabId: activeSplitTabId };
      });

      return {
        ...s,
        nodes: mergedNodes,
        openTabs,
        activeTabId,
        dirty,
        splits,
      };
    });
  }

  async initWorkspaceSystem() {
    if (this.bootstrapped) return;
    this.bootstrapped = true;

    try {
      const res = await workspacesList();
      let items = res.items ?? [];

      if (!items.length) {
        await workspacesCreate("default_workspace");
        items = ["default_workspace"];
      }

      const current = items.includes(this.state.currentWorkspace) ? this.state.currentWorkspace : items[0];

      this.setState((s) => ({
        ...s,
        workspaces: items,
        currentWorkspace: current,
      }));

      await this.switchWorkspace(current);
    } catch (e) {
      console.error(e);
      this.toast("Failed to initialize workspaces", "error");
    }
  }

  toast(message: string, kind: "info" | "error" = "info") {
    const id = uid();
    this.setState((s) => ({ ...s, toasts: [...s.toasts, { id, message, kind }] }));
    window.setTimeout(() => this.dismissToast(id), 2400);
  }

  dismissToast(id: string) {
    this.setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
  }

  searchDocumentation(query: string) {
    const docs = searchDocs(query).map((d) => ({ kind: "doc", item: d }));
    const local = this.searchInFiles(query).map((m) => ({
      kind: "local",
      nodeId: m.nodeId,
      title: m.path,
      path: m.path,
      preview: m.preview,
    }));
    return [...docs, ...local];
  }

  openDocumentationUrl(url: string) {
    window.open(url, "_blank");
  }

  setTheme(theme: "dark" | "light") {
    this.setState((s) => ({ ...s, theme }));
  }

  toggleTheme() {
    this.setTheme(this.state.theme === "dark" ? "light" : "dark");
  }

  setActivity(activity: ActivityView) {
    this.setState((s) => ({ ...s, activity }));
  }

  setBottomView(bottomView: BottomView) {
    this.setState((s) => ({ ...s, bottomView }));
  }

  toggleBottomPanel() {
    this.setState((s) => ({ ...s, layout: { ...s.layout, showBottomPanel: !s.layout.showBottomPanel } }));
  }

  toggleSidePanel() {
    this.setState((s) => ({ ...s, layout: { ...s.layout, showSidePanel: !s.layout.showSidePanel } }));
  }

  resizeSidePanel(sideWidth: number) {
    this.setState((s) => ({ ...s, layout: { ...s.layout, sideWidth: Math.max(200, Math.min(520, sideWidth)) } }));
  }

  resizeBottomPanel(bottomHeight: number) {
    this.setState((s) => ({
      ...s,
      layout: { ...s.layout, bottomHeight: Math.max(120, Math.min(420, bottomHeight)) },
    }));
  }

  async refreshWorkspaces() {
    const res = await workspacesList();
    const items = res.items ?? [];
    this.setState((s) => ({
      ...s,
      workspaces: items,
      currentWorkspace: items.includes(s.currentWorkspace) ? s.currentWorkspace : items[0] ?? "default_workspace",
    }));
  }

  async switchWorkspace(name: string) {
    try {
      const res = await wsTree(name, "");
      const nodes = buildNodesFromTree((res.items ?? []) as WorkspaceTreeItem[], name);
      this.closeCompileStream();

      this.setState((s) => ({
        ...s,
        nodes,
        currentWorkspace: name,
        openTabs: [],
        activeTabId: null,
        dirty: {},
        closedTabStack: [],
        splits: s.splits.map((sp) => ({ ...sp, tabIds: [], activeTabId: null })),
        recentFiles: [],
        outputLines: [...s.outputLines, `[workspace] switched to ${name}`].slice(-800),
      }));
    } catch (e) {
      console.error(e);
      this.toast(`Failed to switch workspace: ${name}`, "error");
    }
  }

  async createWorkspaceAndSwitch(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    try {
      const res = await workspacesCreate(trimmed);
      if (!res.ok) {
        this.toast("Failed to create workspace", "error");
        return false;
      }
      await this.refreshWorkspaces();
      await this.switchWorkspace(trimmed);
      this.toast(`Workspace created: ${trimmed}`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Failed to create workspace", "error");
      return false;
    }
  }

  async renameCurrentWorkspace(newName: string) {
    const oldName = this.state.currentWorkspace;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return false;
    try {
      const res = await workspacesRename(oldName, trimmed);
      if (!res.ok) {
        this.toast("Rename failed", "error");
        return false;
      }
      await this.refreshWorkspaces();
      await this.switchWorkspace(trimmed);
      this.toast(`Workspace renamed to ${trimmed}`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Rename failed", "error");
      return false;
    }
  }

  async deleteCurrentWorkspace() {
    const name = this.state.currentWorkspace;
    if (!window.confirm(`Delete workspace "${name}"?`)) return false;

    try {
      const res = await workspacesDelete(name);
      if (!res.ok) {
        this.toast("Delete failed", "error");
        return false;
      }

      await this.refreshWorkspaces();

      const next = this.state.workspaces.find((w) => w !== name) ?? "default_workspace";
      if (!this.state.workspaces.length) {
        await workspacesCreate("default_workspace");
        await this.refreshWorkspaces();
      }

      await this.switchWorkspace(next);
      this.toast(`Deleted workspace: ${name}`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Delete failed", "error");
      return false;
    }
  }

  async deleteAllCurrentWorkspace() {
    const name = this.state.currentWorkspace;
    if (!window.confirm(`Delete all files in "${name}"?`)) return false;

    try {
      const res = await workspacesDeleteAll(name);
      if (!res.ok) {
        this.toast("Delete all failed", "error");
        return false;
      }
      await this.switchWorkspace(name);
      this.toast(`Cleared workspace: ${name}`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Delete all failed", "error");
      return false;
    }
  }

  async backupCurrentWorkspace() {
    try {
      const blob = await workspacesBackup(this.state.currentWorkspace);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.state.currentWorkspace}.backup.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast("Workspace backup downloaded");
    } catch (e) {
      console.error(e);
      this.toast("Backup failed", "error");
    }
  }

  async downloadCurrentWorkspace() {
    try {
      const blob = await workspacesDownload(this.state.currentWorkspace);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.state.currentWorkspace}.workspace.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast("Workspace downloaded");
    } catch (e) {
      console.error(e);
      this.toast("Download failed", "error");
    }
  }

  async restoreCurrentWorkspaceFromFile(file: File) {
    try {
      const res = await workspacesRestore(this.state.currentWorkspace, file);
      if (!res.ok) {
        this.toast(res.error || "Restore failed", "error");
        return false;
      }
      await this.switchWorkspace(this.state.currentWorkspace);
      this.toast("Workspace restored");
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Restore failed", "error");
      return false;
    }
  }

  openFile(nodeId: string, splitId = "primary") {
    const node = this.state.nodes[nodeId];
    if (!node || node.type !== "file") return;

    const exists = this.state.openTabs.find((t) => t.nodeId === nodeId);
    const path = pathOf(nodeId, this.state.nodes);
    const tab = exists ?? { id: uid(), nodeId, title: node.name, path };

    this.setState((s) => {
      const openTabs = exists ? s.openTabs : [...s.openTabs, tab];
      const recentFiles = [nodeId, ...s.recentFiles.filter((x) => x !== nodeId)].slice(0, 15);
      const splits = s.splits.map((sp) =>
        sp.id === splitId
          ? { ...sp, tabIds: sp.tabIds.includes(tab.id) ? sp.tabIds : [...sp.tabIds, tab.id], activeTabId: tab.id }
          : sp
      );

      return {
        ...s,
        openTabs,
        activeTabId: tab.id,
        recentFiles,
        splits,
        activeLanguage: node.language ?? detectLanguage(node.name),
      };
    });

    const currentNode = this.state.nodes[nodeId];
    const currentPath = pathOf(nodeId, this.state.nodes);

    if (
      currentNode &&
      currentNode.type === "file" &&
      (currentNode.content ?? "") === "" &&
      currentPath &&
      !this.loadingFileIds.has(nodeId)
    ) {
      this.loadingFileIds.add(nodeId);

      wsRead(this.state.currentWorkspace, currentPath)
        .then((r) => {
          const content = typeof r?.content === "string" ? r.content : "";

          this.setState((s) => {
            const target = s.nodes[nodeId];
            if (!target || target.type !== "file") return s;

            return {
              ...s,
              nodes: {
                ...s.nodes,
                [nodeId]: {
                  ...target,
                  content,
                  language: target.language ?? detectLanguage(target.name),
                },
              },
            };
          });
        })
        .catch((e) => {
          console.error(e);
          this.toast(`Failed to read ${currentPath}`, "error");
        })
        .finally(() => {
          this.loadingFileIds.delete(nodeId);
        });
    }
  }

  closeTab(tabId: string) {
    this.setState((s) => {
      const tab = s.openTabs.find((t) => t.id === tabId);
      const openTabs = s.openTabs.filter((t) => t.id !== tabId);
      const splits = s.splits.map((sp) => ({
        ...sp,
        tabIds: sp.tabIds.filter((id) => id !== tabId),
        activeTabId: sp.activeTabId === tabId ? sp.tabIds.find((x) => x !== tabId) ?? null : sp.activeTabId,
      }));
      return {
        ...s,
        openTabs,
        activeTabId: s.activeTabId === tabId ? openTabs[openTabs.length - 1]?.id ?? null : s.activeTabId,
        closedTabStack: tab ? [tab, ...s.closedTabStack] : s.closedTabStack,
        splits,
      };
    });
  }

  reopenClosedTab() {
    const tab = this.state.closedTabStack[0];
    if (!tab) return this.toast("No recently closed tab");
    this.setState((s) => ({ ...s, closedTabStack: s.closedTabStack.slice(1) }));
    this.openFile(tab.nodeId);
  }

  updateContent(tabId: string, content: string) {
    const tab = this.state.openTabs.find((t) => t.id === tabId);
    if (!tab) return;
    this.setState((s) => ({
      ...s,
      nodes: { ...s.nodes, [tab.nodeId]: { ...s.nodes[tab.nodeId], content } },
      dirty: { ...s.dirty, [tab.nodeId]: true },
    }));
  }

  async saveFile(tabId: string) {
    const tab = this.state.openTabs.find((t) => t.id === tabId);
    if (!tab) return;

    const node = this.state.nodes[tab.nodeId];
    const content = node?.content ?? "";

    try {
      await wsWrite(this.state.currentWorkspace, tab.path, content);
      this.setState((s) => {
        const dirty = { ...s.dirty };
        delete dirty[tab.nodeId];
        return { ...s, dirty, outputLines: [...s.outputLines, `[save] ${tab.path}`].slice(-800) };
      });
      this.toast("File saved");
    } catch (e) {
      console.error(e);
      this.toast("Save failed", "error");
    }
  }

  async saveAll() {
    const tabs = [...this.state.openTabs];
    for (const tab of tabs) {
      if (this.state.dirty[this.state.nodes[tab.nodeId]?.id ?? ""]) {
        await this.saveFile(tab.id);
      }
    }
    this.toast("All files saved");
  }

  async compileActiveFile(): Promise<boolean> {
    const activeTab = this.state.openTabs.find((t) => t.id === this.state.activeTabId) ?? null;
    if (!activeTab) {
      this.toast("Open a contract file first.", "error");
      return false;
    }

    const activeNode = this.state.nodes[activeTab.nodeId];
    if (!activeNode || activeNode.type !== "file") {
      this.toast("No active file selected.", "error");
      return false;
    }

    const lowerPath = activeTab.path.toLowerCase();

    if (lowerPath.endsWith(".ak")) {
      this.toast("Aiken starter generation is supported, but backend compile wiring is not connected yet.", "error");
      return false;
    }

    if (lowerPath.endsWith(".py")) {
      this.toast("Opshin starter generation is supported, but backend compile wiring is not connected yet.", "error");
      return false;
    }

    if (lowerPath.endsWith(".hl")) {
      this.toast("Helios starter generation is supported, but backend compile wiring is not connected yet.", "error");
      return false;
    }

    if (lowerPath.endsWith(".compact") || lowerPath.endsWith(".mid")) {
      this.toast("Midnight starter generation is supported, but backend compile wiring is not connected yet.", "error");
      return false;
    }

    const isHs = lowerPath.endsWith(".hs");
    if (!isHs) {
      this.toast("Selected file must be a .hs file for the current compile pipeline.", "error");
      return false;
    }

    if (this.state.dirty[activeNode.id]) {
      await this.saveFile(activeTab.id);
    }

    this.closeCompileStream();

    this.setState((s) => ({
      ...s,
      layout: { ...s.layout, showBottomPanel: true },
      bottomView: "output",
      outputLines: [...s.outputLines, `[compile] starting ${activeTab.path}`].slice(-800),
    }));

    try {
      const res = await startCompile(this.state.currentWorkspace, activeTab.path);
      if (!res?.jobId) {
        this.toast("Failed to start compile job.", "error");
        return false;
      }

      const es = new EventSource(streamUrl(res.jobId));
      this.compileStream = es;

      es.addEventListener("log", (event: MessageEvent) => {
        this.pushOutputLine(String(event.data ?? ""));
      });

      es.addEventListener("done", async (event: MessageEvent) => {
        let ok = false;
        try {
          const payload = JSON.parse(String(event.data ?? "{}"));
          ok = !!payload.ok;
        } catch {
          ok = false;
        }

        this.pushOutputLine(ok ? "[compile] completed successfully" : "[compile] failed");
        this.closeCompileStream();

        if (ok) {
          try {
            await this.refreshWorkspaceTreePreservingOpenTabs();
            this.toast("Compile completed. Artifacts refreshed.");
          } catch (e) {
            console.error(e);
          }
        } else {
          this.toast("Compile failed. Check Output.", "error");
        }
      });

      es.onerror = () => {
        if (this.compileStream !== es) return;
        this.pushOutputLine("[compile] stream disconnected");
        this.closeCompileStream();
      };

      return true;
    } catch (e) {
      console.error(e);
      this.toast("Failed to start compile job.", "error");
      return false;
    }
  }

  setCursor(line: number, column: number) {
    this.setState((s) => ({ ...s, cursor: { line, column } }));
  }

  setLanguage(tabId: string, language: LanguageMode) {
    const tab = this.state.openTabs.find((t) => t.id === tabId);
    if (!tab) return;
    this.setState((s) => ({
      ...s,
      nodes: { ...s.nodes, [tab.nodeId]: { ...s.nodes[tab.nodeId], language } },
      activeLanguage: language,
    }));
  }

  async createNode(parentId: string, type: "file" | "folder", name: string) {
    const parent = this.state.nodes[parentId];
    if (!parent || parent.type !== "folder") return;

    const parentPath = pathOf(parentId, this.state.nodes);
    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    try {
      if (type === "folder") await wsMkdir(this.state.currentWorkspace, fullPath);
      else await wsTouch(this.state.currentWorkspace, fullPath);

      await this.switchWorkspace(this.state.currentWorkspace);
      this.toast(`${type} created`);

      if (type === "file") {
        const newId = nodeIdFor("file", fullPath);
        this.openFile(newId);
      }
    } catch (e) {
      console.error(e);
      this.toast(`${type} creation failed`, "error");
    }
  }

  private async uniqueRootFolderName(base: string): Promise<string> {
    const existing = new Set(
      Object.values(this.state.nodes)
        .filter((n) => n.type === "folder" && n.parentId === "root")
        .map((n) => n.name)
    );

    let candidate = base;
    let i = 2;

    while (existing.has(candidate)) {
      candidate = `${base}-${i}`;
      i += 1;
    }

    return candidate;
  }

  async createTemplateFile(kind: CardanoTemplateKind): Promise<string | null> {
    try {
      const workspace = this.state.currentWorkspace || "default_workspace";
      const folder =
        kind === "plutus-starter"
          ? await this.uniqueRootFolderName("plutus-starter")
          : kind === "minting-policy"
          ? await this.uniqueRootFolderName("minting-policy")
          : await this.uniqueRootFolderName("validator-script");

      const files =
        kind === "plutus-starter"
          ? plutusStarterScaffold(folder)
          : kind === "minting-policy"
          ? mintingPolicyScaffold(folder)
          : validatorScriptScaffold(folder);

      for (const file of files) {
        await wsWrite(workspace, file.path, file.content);
      }

      await this.switchWorkspace(workspace);

      const openPath =
        kind === "plutus-starter"
          ? `${folder}/src/Validator.hs`
          : kind === "minting-policy"
          ? `${folder}/src/MintingPolicy.hs`
          : `${folder}/src/ScriptValidator.hs`;

      const newId = nodeIdFor("file", openPath);
      this.openFile(newId);
      this.toast(`${folder} created in ${workspace}`);
      return newId;
    } catch (e) {
      console.error(e);
      this.toast("Failed to create template file", "error");
      return null;
    }
  }

  async createLanguageStarter(language: StarterLanguage): Promise<string | null> {
    try {
      const workspace = this.state.currentWorkspace || "default_workspace";
      const folder = await this.uniqueRootFolderName(`${language}-starter`);
      const bundle = buildLanguageStarterTemplate(language, folder);

      for (const file of bundle.files) {
        await wsWrite(workspace, file.path, file.content);
      }

      await this.switchWorkspace(workspace);

      const newId = nodeIdFor("file", bundle.openPath);
      this.openFile(newId);
      this.toast(`${folder} created in ${workspace}`);
      return newId;
    } catch (e) {
      console.error(e);
      this.toast("Failed to create language starter", "error");
      return null;
    }
  }

  async renameNode(id: string, name: string) {
    const node = this.state.nodes[id];
    if (!node || !node.parentId) return;

    const oldPath = pathOf(id, this.state.nodes);
    const parentPath = pathOf(node.parentId, this.state.nodes);
    const newPath = parentPath ? `${parentPath}/${name}` : name;

    try {
      await wsRename(this.state.currentWorkspace, oldPath, newPath);
      await this.switchWorkspace(this.state.currentWorkspace);
    } catch (e) {
      console.error(e);
      this.toast("Rename failed", "error");
    }
  }

  async deleteNode(id: string) {
    const node = this.state.nodes[id];
    if (!node || !node.parentId) return;
    if (!window.confirm("Delete item? This cannot be undone.")) return;

    try {
      await wsDelete(this.state.currentWorkspace, pathOf(id, this.state.nodes));
      this.setState((s) => ({
        ...s,
        openTabs: s.openTabs.filter((t) => t.nodeId !== id),
      }));
      await this.switchWorkspace(this.state.currentWorkspace);
    } catch (e) {
      console.error(e);
      this.toast("Delete failed", "error");
    }
  }

  duplicateNode(id: string) {
    const node = this.state.nodes[id];
    if (!node || !node.parentId) return;
    void this.createNode(node.parentId, node.type, `${node.name}.copy`);
  }

  async moveNode(id: string, parentId: string) {
    const node = this.state.nodes[id];
    const parent = this.state.nodes[parentId];
    if (!node || !node.parentId || !parent || parent.type !== "folder") return;

    const oldPath = pathOf(id, this.state.nodes);
    const newParentPath = pathOf(parentId, this.state.nodes);
    const newPath = newParentPath ? `${newParentPath}/${node.name}` : node.name;

    try {
      await wsRename(this.state.currentWorkspace, oldPath, newPath);
      await this.switchWorkspace(this.state.currentWorkspace);
    } catch (e) {
      console.error(e);
      this.toast("Move failed", "error");
    }
  }

  setSplitOrientation(splitOrientation: Layout["splitOrientation"]) {
    this.setState((s) => ({ ...s, layout: { ...s.layout, splitOrientation } }));
  }

  registerCommand(command: Command) {
    this.setState((s) => ({ ...s, commands: { ...s.commands, [command.id]: command } }));
  }

  executeCommand(id: string, args?: unknown) {
    const cmd = this.state.commands[id];
    if (!cmd) return this.toast(`Command not found: ${id}`, "error");
    try {
      cmd.handler(args);
    } catch {
      this.toast(`Command failed: ${cmd.title}`, "error");
    }
  }

  runTerminalInput(input: string) {
    this.setState((s) => ({
      ...s,
      terminalLines: [...s.terminalLines, `$ ${input}`, `Executed: ${input}`].slice(-500),
      outputLines: [...s.outputLines, `[terminal] ${input}`].slice(-800),
    }));
  }

  clearOutput() {
    this.setState((s) => ({ ...s, outputLines: [] }));
  }

  searchInFiles(query: string) {
    const q = query.toLowerCase();
    return Object.values(this.state.nodes)
      .filter((n) => n.type === "file" && (n.content ?? "").toLowerCase().includes(q))
      .map((n) => ({
        nodeId: n.id,
        path: pathOf(n.id, this.state.nodes),
        preview: (n.content ?? "").split("\n").find((line) => line.toLowerCase().includes(q)) ?? "",
      }));
  }

  exportWorkspace() {
    void this.downloadCurrentWorkspace();
  }

  importWorkspace(file: File) {
    void this.restoreCurrentWorkspaceFromFile(file);
  }

  resetWorkspace() {
    void this.deleteAllCurrentWorkspace();
  }

  private async persistImportedFiles(files: ImportedFile[], rootFolderName = "imports") {
    for (const f of files) {
      const remotePath = `${rootFolderName}/${f.path}`.replace(/^\/+/, "");
      await wsWrite(this.state.currentWorkspace, remotePath, f.content);
    }
    await this.switchWorkspace(this.state.currentWorkspace);
  }

  async openFromFilePicker(): Promise<boolean> {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "*/*";

      const files: File[] = await new Promise((resolve) => {
        input.onchange = () => resolve(Array.from(input.files ?? []));
        input.click();
      });

      if (!files.length) return false;

      const imported: ImportedFile[] = [];
      for (const f of files) imported.push({ path: f.name, content: await f.text() });

      await this.persistImportedFiles(imported, "opened");
      this.toast(`Opened ${files.length} file(s)`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Open failed", "error");
      return false;
    }
  }

  async openFolderFromPicker(): Promise<boolean> {
    try {
      const files = await pickFolderAsFiles();
      if (!files.length) return false;
      await this.persistImportedFiles(files, "folder-upload");
      this.toast(`Uploaded folder (${files.length} file(s))`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Folder upload not supported or cancelled.", "error");
      return false;
    }
  }

  async importFromHttp(url: string): Promise<boolean> {
    try {
      const files = await importFromHttpUrl(url);
      if (!files.length) {
        this.toast("No importable content from URL", "error");
        return false;
      }
      await this.persistImportedFiles(files, "https-import");
      this.toast("Imported from URL");
      return true;
    } catch (e) {
      console.error(e);
      this.toast("HTTPS import failed", "error");
      return false;
    }
  }

  async importFromIpfs(cidOrUrl: string): Promise<boolean> {
    try {
      const files = await importFromIpfsRef(cidOrUrl);
      if (!files.length) {
        this.toast("IPFS import returned no files", "error");
        return false;
      }
      await this.persistImportedFiles(files, "ipfs-import");
      this.toast(`Imported from IPFS (${files.length} file(s))`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("IPFS import failed", "error");
      return false;
    }
  }

  async connectLocalFilesystem(): Promise<boolean> {
    try {
      const dir = await connectDirectoryPicker();
      if (!dir) return false;
      const files = await readDirectoryAsFiles(dir);
      if (!files.length) {
        this.toast("No files found in selected directory");
        return false;
      }
      await this.persistImportedFiles(files, dir.name || "local");
      this.toast(`Connected: ${dir.name} (${files.length} file(s))`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Local filesystem not supported in this browser or permission denied.", "error");
      return false;
    }
  }

  async importFromGist(gistIdOrUrl: string): Promise<boolean> {
    try {
      const id = parseGistId(gistIdOrUrl);
      if (!id) {
        this.toast("Invalid Gist URL/ID", "error");
        return false;
      }

      const tokenKey = "cardano.ide.github.token";
      let token = localStorage.getItem(tokenKey) ?? undefined;

      if (!token) {
        const maybe = window.prompt("Optional: paste a GitHub token to avoid rate limits (leave blank to continue without):");
        if (maybe && maybe.trim()) {
          token = maybe.trim();
          localStorage.setItem(tokenKey, token);
        }
      }

      const files = await fetchGistFiles(id, token);
      if (!files.length) {
        this.toast("Gist had no importable files", "error");
        return false;
      }

      await this.persistImportedFiles(files, `gist-${id.slice(0, 6)}`);
      this.toast(`Imported gist (${files.length} file(s))`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Gist import failed (rate limit or network issue).", "error");
      return false;
    }
  }

  async cloneRepo(repoUrl: string, project = this.state.currentWorkspace): Promise<boolean> {
    try {
      const res = await wsClone(project, repoUrl);
      if (!res.ok) {
        this.toast(res.error || "Clone failed", "error");
        return false;
      }
      await this.switchWorkspace(project);
      this.toast(`Cloned into ${project}`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Clone failed (backend missing /clone endpoint?)", "error");
      return false;
    }
  }

  setFileAtPath(path: string, content: string) {
    this.setState((s) => {
      const nextNodes = setFileAtPath(s.nodes, s.rootId, path, content, detectLanguage);
      return { ...s, nodes: nextNodes };
    });
  }
}

export const ideStore = new IDEStore();

export function useIDEStore<T>(selector: (state: State) => T) {
  return useSyncExternalStore(ideStore.subscribe, () => selector(ideStore.getState()), () => selector(ideStore.getState()));
}

export const toPath = pathOf;