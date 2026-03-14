import React from "react";
import { ideStore, useIDEStore } from "../../state/store";

export function EditorTabs({ splitId }: { splitId: string }) {
  const split = useIDEStore((s) => s.splits.find((sp) => sp.id === splitId));
  const tabs = useIDEStore((s) => s.openTabs);
  const dirty = useIDEStore((s) => s.dirty);

  if (!split) return null;

  return (
    <div className="tabsRow2" role="tablist" aria-label="Editor tabs">
      {split.tabIds.map((id) => {
        const tab = tabs.find((t) => t.id === id);
        if (!tab) return null;

        const isActive = split.activeTabId === id;

        return (
          <div
            key={id}
            className={`tab2 ${isActive ? "active" : ""}`}
            role="tab"
            aria-selected={isActive}
          >
            <button
              className="tab2Btn"
              onClick={() => ideStore.openFile(tab.nodeId, splitId)}
              title={tab.path}
              type="button"
            >
              <span className="tab2Title">{tab.title}</span>
              {dirty[tab.nodeId] ? <span className="tab2Dot">●</span> : null}
            </button>

            <button
              className="tab2Close"
              onClick={() => ideStore.closeTab(id)}
              title="Close"
              type="button"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}