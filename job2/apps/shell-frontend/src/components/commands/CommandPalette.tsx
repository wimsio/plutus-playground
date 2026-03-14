import React, { useMemo, useState } from "react";
import { ideStore, useIDEStore } from "../../state/store";
import { fuzzyFilter } from "../../utils/fuzzy";

type Command = {
  id: string;
  title: string;
  handler: () => void;
  keybinding?: string;
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");

  // ✅ stable reference (object)
  const commandsMap = useIDEStore((s) => s.commands) as Record<string, Command>;

  // ✅ convert to array outside selector
  const commands = useMemo(() => Object.values(commandsMap), [commandsMap]);

  const filtered = useMemo(
    () => fuzzyFilter(commands, query, (c) => `${c.title} ${c.id}`),
    [commands, query]
  );

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="paletteInput"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command"
        />
        <div className="paletteList">
          {filtered.map((c) => (
            <button
              key={c.id}
              className="paletteItem"
              onClick={() => {
                ideStore.executeCommand(c.id);
                onClose();
              }}
            >
              <span>{c.title}</span>
              <small>{c.keybinding ?? c.id}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}