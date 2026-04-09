export type NodeType = "file" | "folder";

export type LanguageMode =
  | "typescript"
  | "javascript"
  | "json"
  | "markdown"
  | "plaintext"
  | "haskell"
  | "python"
  | "html"
  | "css"
  | "php"
  | "xml"
  | "yaml"
  | "sql";

export type StarterLanguage = "haskell" | "aiken" | "opshin" | "helios" | "midnight";

export type WorkspaceNode = {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  childrenIds?: string[];
  content?: string;
  language?: LanguageMode;
};

export type ActivityView = "explorer" | "search" | "source" | "tests" | "extensions";

export type BottomView = "terminal" | "output" | "problems";

export type EditorSplit = {
  id: string;
  tabIds: string[];
  activeTabId: string | null;
};

export type OpenTab = {
  id: string;
  nodeId: string;
  title: string;
  path: string;
};

export type Diagnostic = {
  id: string;
  nodeId: string;
  message: string;
  severity: "error" | "warning";
  line: number;
  column: number;
};

export type Command = {
  id: string;
  title: string;
  handler: (args?: unknown) => void;
  keybinding?: string;
};