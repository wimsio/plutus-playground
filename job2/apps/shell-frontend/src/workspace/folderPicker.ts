import type { ImportedFile } from "./importers.ts";

/**
 * Folder picker using <input webkitdirectory>.
 * Works in Chromium browsers. If unsupported, user will just get no files.
 */
export async function pickFolderAsFiles(): Promise<ImportedFile[]> {
  const input = document.createElement("input");
  input.type = "file";
  
  input.webkitdirectory = true;
  input.multiple = true;

  const files: File[] = await new Promise((resolve) => {
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });

  if (!files.length) return [];

  const imported: ImportedFile[] = [];
  for (const f of files) {
    // Keep nested path if available
    const rel = (f as any).webkitRelativePath || f.name;
    const content = await f.text();
    imported.push({ path: rel, content });
  }
  return imported;
}