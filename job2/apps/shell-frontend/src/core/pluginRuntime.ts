import type { PluginDefinition } from "@ide/plugin-sdk";
import { createHost } from "./host";

import fileExplorerPlugin from "@ide/plugin-file-explorer";
import compilerPlugin from "@ide/plugin-compiler";

/** core/pluginRuntime.ts */
type CommandHandler = (args?: any) => Promise<any> | any;

export function createCommandRegistry() {
  const map = new Map<string, CommandHandler>();
  return {
    register(id: string, handler: CommandHandler) {
      map.set(id, handler);
    },
    get(id: string) {
      return map.get(id);
    },
    list() {
      return [...map.keys()];
    },
  };
}

export function loadPlugins(store: any, project: string) {
  // create host as usual
  const host: any = createHost(store, project);

  // ✅ attach commands registry to host so plugins can call host.commands.get(...)
  if (!host.commands) host.commands = createCommandRegistry();

  // ✅ register editor openFile command (App will override if it wants)
  host.commands.register("editor.openFile", async ({ path }: { path: string }) => {
    // fallback: store can implement openFile
    if (typeof store.openFile === "function") return store.openFile(path);

    // fallback: global handler if App sets it
    if (typeof (window as any).__IDE_OPEN_FILE__ === "function") {
      return (window as any).__IDE_OPEN_FILE__(path);
    }

    host.ui?.notify?.(`No handler for editor.openFile. path=${path}`);
  });

  // load plugins
  const plugins: PluginDefinition[] = [fileExplorerPlugin, compilerPlugin];
  for (const p of plugins) p.activate(host);

  // ✅ return host so App can use it if needed
  return host;
}