import type { ImportedFile } from "./importers";

export async function connectDirectoryPicker(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as any).showDirectoryPicker as
    | ((opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>)
    | undefined;

  if (!picker) return null;
  return picker({ mode: "read" });
}

async function readDirRecursive(dir: FileSystemDirectoryHandle, prefix: string): Promise<ImportedFile[]> {
  const out: ImportedFile[] = [];

  // entries() is supported by modern Chromium
  for await (const [name, handle] of (dir as any).entries()) {
    const p = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      const content = await file.text();
      out.push({ path: p, content });
    } else if (handle.kind === "directory") {
      out.push(...(await readDirRecursive(handle as FileSystemDirectoryHandle, p)));
    }
  }

  return out;
}

export async function readDirectoryAsFiles(dir: FileSystemDirectoryHandle): Promise<ImportedFile[]> {
  return readDirRecursive(dir, "");
}