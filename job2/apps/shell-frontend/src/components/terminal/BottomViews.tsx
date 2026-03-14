import React, { useState } from "react";
import { ideStore, useIDEStore } from "../../state/store";

export function BottomViews() {
  const view = useIDEStore((s) => s.bottomView);
  const terminalLines = useIDEStore((s) => s.terminalLines);
  const outputLines = useIDEStore((s) => s.outputLines);
  const problems = useIDEStore((s) => s.diagnostics);
  const [input, setInput] = useState("");

  return (
    <>
      <div className="bottomTabs">
        <div className="bottomTabsLeft">
          {(["terminal", "output", "problems"] as const).map((v) => (
            <button key={v} className={view === v ? "active" : ""} onClick={() => ideStore.setBottomView(v)}>
              {v}
            </button>
          ))}
        </div>

        <div className="bottomTabsRight">
          {view === "output" && <button onClick={() => ideStore.clearOutput()}>Clear</button>}
          <button onClick={() => ideStore.toggleBottomPanel()} title="Hide terminal">
            Hide
          </button>
        </div>
      </div>

      <div className="bottomBody">
        {view === "terminal" && (
          <div className="mono">
            {terminalLines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) ideStore.runTerminalInput(input);
                setInput("");
              }}
            >
              <span>$ </span>
              <input value={input} onChange={(e) => setInput(e.target.value)} />
            </form>
          </div>
        )}

        {view === "output" && <pre className="mono">{outputLines.join("\n") || "No logs yet"}</pre>}

        {view === "problems" && (
          <div>
            {problems.length === 0
              ? "No problems"
              : problems.map((p) => (
                  <div key={p.id}>
                    {p.severity.toUpperCase()} {p.line}:{p.column} {p.message}
                  </div>
                ))}
          </div>
        )}
      </div>
    </>
  );
}