import React from "react";
import type { HostApi, PluginDefinition } from "@ide/plugin-sdk";

function CompilerPanel({ host }: { host: HostApi }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 10 }}>
        Compile your Plutus project and stream logs into the terminal.
      </div>
      <button
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "none", background: "#1d4ed8", color: "white", cursor: "pointer" }}
        onClick={async () => {
          const { jobId } = await host.jobs.startCompile("demo");
          host.ui.notify(`Compile started: ${jobId}`);
        }}
      >
        Compile
      </button>
    </div>
  );
}

const plugin: PluginDefinition = {
  id: "plugin.compiler",
  name: "Compiler",
  version: "0.1.0",
  activate(host: HostApi) {
    host.panels.register({
      id: "compiler.panel",
      title: "Compiler",
      location: "right",
      render: () => <CompilerPanel host={host} />
    });

    host.commands.register({
      id: "plutus.compile",
      title: "Compile (Plutus)",
      handler: async (payload: any) => {
        const project = payload?.project ?? "demo";
        const { jobId } = await host.jobs.startCompile(project);
        const url = host.jobs.streamLogsUrl(jobId);

        payload?.setSseUrl?.(url);
        host.ui.notify(`Streaming logs for ${jobId}`);
      }
    });

    host.toolbar.register({
      id: "toolbar.compile",
      title: "Compile",
      commandId: "plutus.compile"
    });
  }
};

export default plugin;
