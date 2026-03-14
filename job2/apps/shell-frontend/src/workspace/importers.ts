import type { WorkspaceNode, LanguageMode } from "../types";

export type ImportedFile = {
  path: string; // e.g. "src/Main.ts"
  content: string;
};

const uid = () => Math.random().toString(36).slice(2, 9);

function normalizePath(p: string) {
  return p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/g, "");
}

function splitPath(p: string) {
  const norm = normalizePath(p);
  return norm ? norm.split("/").filter(Boolean) : [];
}

function detectLanguage(name: string): LanguageMode {
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "javascript";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".md")) return "markdown";
  if (name.endsWith(".hs")) return "haskell" as any; // if you have it in your union, remove "as any"
  return "plaintext";
}

/**
 * Ensures a folder exists as a child of parentId.
 * Returns folder node id.
 */
function ensureFolder(
  nodes: Record<string, WorkspaceNode>,
  parentId: string,
  folderName: string
): { nodes: Record<string, WorkspaceNode>; folderId: string } {
  const parent = nodes[parentId];
  if (!parent || parent.type !== "folder") return { nodes, folderId: parentId };

  const childId =
    (parent.childrenIds ?? [])
      .map((id) => nodes[id])
      .find((n) => n && n.type === "folder" && n.name === folderName)?.id ?? null;

  if (childId) return { nodes, folderId: childId };

  const id = uid();
  const folderNode: WorkspaceNode = {
    id,
    name: folderName,
    type: "folder",
    parentId,
    childrenIds: [],
  };

  const nextParent: WorkspaceNode = {
    ...parent,
    childrenIds: [...(parent.childrenIds ?? []), id],
  };

  return {
    nodes: {
      ...nodes,
      [id]: folderNode,
      [parentId]: nextParent,
    },
    folderId: id,
  };
}

/**
 * Creates/updates a file at path inside the workspace tree.
 */
export function setFileAtPath(
  nodes: Record<string, WorkspaceNode>,
  rootId: string,
  filePath: string,
  content: string,
  detectLang: (name: string) => LanguageMode = detectLanguage
): Record<string, WorkspaceNode> {
  const parts = splitPath(filePath);
  if (parts.length === 0) return nodes;

  const fileName = parts[parts.length - 1];
  const folders = parts.slice(0, -1);

  let nextNodes = { ...nodes };
  let curParentId = rootId;

  for (const folderName of folders) {
    const r = ensureFolder(nextNodes, curParentId, folderName);
    nextNodes = r.nodes;
    curParentId = r.folderId;
  }

  const parent = nextNodes[curParentId];
  if (!parent || parent.type !== "folder") return nextNodes;

  // If file already exists in folder by name, update it
  const existingFile =
    (parent.childrenIds ?? [])
      .map((id) => nextNodes[id])
      .find((n) => n && n.type === "file" && n.name === fileName) ?? null;

  if (existingFile) {
    nextNodes[existingFile.id] = {
      ...existingFile,
      content,
      language: existingFile.language ?? detectLang(existingFile.name),
    };
    return nextNodes;
  }

  // Create new file
  const id = uid();
  const fileNode: WorkspaceNode = {
    id,
    name: fileName,
    type: "file",
    parentId: curParentId,
    content,
    language: detectLang(fileName),
  };

  nextNodes[id] = fileNode;
  nextNodes[curParentId] = {
    ...parent,
    childrenIds: [...(parent.childrenIds ?? []), id],
  };

  return nextNodes;
}

/**
 * Bulk import: puts files under a new folder (rootFolderName) inside rootId.
 * Always creates valid nodes (folder/file).
 */
export function importFilesIntoWorkspace(
  nodes: Record<string, WorkspaceNode>,
  rootId: string,
  files: ImportedFile[],
  rootFolderName = "imports"
): Record<string, WorkspaceNode> {
  let nextNodes = { ...nodes };

  // Make a container folder under root
  const ensured = ensureFolder(nextNodes, rootId, rootFolderName);
  nextNodes = ensured.nodes;
  const containerId = ensured.folderId;

  for (const f of files) {
    const p = normalizePath(f.path);
    if (!p) continue;
    nextNodes = setFileAtPath(nextNodes, containerId, p, f.content, detectLanguage);
  }

  return nextNodes;
}