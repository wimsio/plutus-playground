const API_BASE = "http://localhost:8080";

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return { ok: false, error: "Invalid JSON response" };
  }
}

export async function workspacesList() {
  const r = await fetch(`${API_BASE}/api/workspaces`);
  return safeJson(r) as Promise<{ items: string[] }>;
}

export async function workspacesCreate(name: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name }),
  });
  return safeJson(r) as Promise<{ ok: boolean }>;
}

export async function workspacesRename(oldName: string, newName: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ oldName, newName }),
  });
  return safeJson(r) as Promise<{ ok: boolean }>;
}

export async function workspacesDelete(name: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name }),
  });
  return safeJson(r) as Promise<{ ok: boolean }>;
}

export async function workspacesDeleteAll(name: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/delete-all`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name }),
  });
  return safeJson(r) as Promise<{ ok: boolean }>;
}

export async function workspacesDownload(project: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(project)}/download`);
  return r.blob();
}

export async function workspacesBackup(project: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(project)}/backup`);
  return r.blob();
}

export async function workspacesRestore(project: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(project)}/restore`, {
    method: "POST",
    body: fd,
  });
  return safeJson(r) as Promise<{ ok: boolean; error?: string }>;
}

export async function fetchWorkspaceMeta(project: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(project)}/meta`);
  return safeJson(r) as Promise<{
    wmWorkspace: string;
    wmCreatedAt: string;
    wmUpdatedAt: string;
    wmFileWrites: number;
    wmBuildCount: number;
    wmLastBuildStatus: string | null;
    wmLastBuildAt: string | null;
  }>;
}

export async function fetchWorkspaceBuilds(project: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(project)}/builds`);
  return safeJson(r) as Promise<{
    items: Array<{
      brJobId: string;
      brWorkspace: string;
      brSelectedPath: string;
      brStartedAt: string;
      brFinishedAt: string | null;
      brOk: boolean | null;
    }>;
  }>;
}

export async function wsTree(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/tree?path=${encodeURIComponent(path)}`);
  return safeJson(r) as Promise<{ items: any[] }>;
}

export async function wsMkdir(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return safeJson(r);
}

export async function wsTouch(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/touch`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return safeJson(r);
}

export async function wsDelete(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return safeJson(r);
}

export async function wsRename(project: string, from: string, to: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ from, to }),
  });
  return safeJson(r);
}

export async function wsUpload(project: string, dir: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/upload?dir=${encodeURIComponent(dir)}`, {
    method: "POST",
    body: fd,
  });
  return safeJson(r) as Promise<{ ok: boolean; path: string }>;
}

export async function wsList(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/list?path=${encodeURIComponent(path)}`);
  return safeJson(r) as Promise<{ items: string[] }>;
}

export async function wsRead(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/read?path=${encodeURIComponent(path)}`);
  return safeJson(r) as Promise<{ content: string }>;
}

export async function wsWrite(project: string, path: string, content: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/write`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path, content }),
  });
  return safeJson(r) as Promise<{ ok: boolean }>;
}

export async function startCompile(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/build/${encodeURIComponent(project)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return safeJson(r) as Promise<{ jobId: string }>;
}

export function streamUrl(jobId: string) {
  return `${API_BASE}/api/build/${encodeURIComponent(jobId)}/stream`;
}

export async function wsClone(project: string, repoUrl: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ repoUrl }),
  });
  return safeJson(r) as Promise<{ ok: boolean; error?: string; files: Array<{ path: string; content: string }> }>;
}

export async function wsGist(project: string, gistUrl: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(project)}/gist`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ gistUrl }),
  });
  return safeJson(r) as Promise<{
    ok: boolean;
    error?: string;
    files?: Array<{ path: string; content: string }>;
  }>;
}