import type { HostApi, PanelRegistration, CommandRegistration, ToolbarItem } from "@ide/plugin-sdk";
import * as api from "./api";

type Store = {
  panels: PanelRegistration[];
  commands: CommandRegistration[];
  toolbar: ToolbarItem[];
  activeFile: string | null;
  activePanelId: string | null;
  openPanel: (id: string) => void;
  notify: (msg: string) => void;
  setActiveFile: (path: string) => void;
};

export function createHost(store: Store, project: string): HostApi {
  return {
    panels: { register(panel) { store.panels.push(panel); } },
    commands: {
      register(cmd) { store.commands.push(cmd); },
      async execute(id, payload) {
        const cmd = store.commands.find(c => c.id === id);
        if (!cmd) throw new Error(`Command not found: ${id}`);
        await cmd.handler(payload);
      },
      list() { return store.commands; }
    },
    toolbar: { register(item) { store.toolbar.push(item); }, list() { return store.toolbar; } },
    fs: {
      async list(path) { const res = await api.wsList(project, path); return res.items; },
      async readFile(path) { const res = await api.wsRead(project, path); return res.content; },
      async writeFile(path, content) { await api.wsWrite(project, path, content); }
    },
    jobs: {
      async startCompile(p) { return api.startCompile(p); },
      streamLogsUrl(jobId) { return api.streamUrl(jobId); }
    },
    ui: {
      notify(msg) { store.notify(msg); },
      openPanel(panelId) { store.openPanel(panelId); },
      setActiveFile(path) { store.setActiveFile(path); },
      getActiveFile() { return store.activeFile; }
    }
  };
}
