export type CommandHandler = (payload?: unknown) => Promise<void> | void;

export type PanelLocation = "left" | "main" | "bottom" | "right";

export type PanelRegistration = {
  id: string;
  title: string;
  location: PanelLocation;
  render: () => any;
};

export type CommandRegistration = {
  id: string;
  title: string;
  handler: CommandHandler;
  shortcut?: string;
};

export type ToolbarItem = {
  id: string;
  title: string;
  commandId: string;
};

export type PluginDefinition = {
  id: string;
  name: string;
  version: string;
  activate: (host: HostApi) => void;
};

export type HostApi = {
  panels: {
    register: (panel: PanelRegistration) => void;
  };
  commands: {
    register: (cmd: CommandRegistration) => void;
    execute: (id: string, payload?: unknown) => Promise<void>;
    list: () => CommandRegistration[];
  };
  toolbar: {
    register: (item: ToolbarItem) => void;
    list: () => ToolbarItem[];
  };
  fs: {
    list: (path: string) => Promise<string[]>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
  };
  jobs: {
    startCompile: (project: string) => Promise<{ jobId: string }>;
    streamLogsUrl: (jobId: string) => string;
  };
  ui: {
    notify: (msg: string) => void;
    openPanel: (panelId: string) => void;
    setActiveFile: (path: string) => void;
    getActiveFile: () => string | null;
  };
};
