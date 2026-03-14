import React, { useEffect, useRef } from "react";

export function Terminal({ sseUrl }: { sseUrl: string | null }) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!sseUrl) return;
    const el = ref.current;
    if (!el) return;

    el.textContent += `\n[terminal] connecting ${sseUrl}\n`;

    const es = new EventSource(sseUrl);
    es.addEventListener("log", (e: any) => {
      try {
        const data = JSON.parse(e.data);
        el.textContent += data.line + "\n";
        el.scrollTop = el.scrollHeight;
      } catch {
        el.textContent += String(e.data) + "\n";
      }
    });
    es.addEventListener("error", () => {
      el.textContent += "\n[terminal] stream error/disconnected\n";
    });

    return () => es.close();
  }, [sseUrl]);

  return (
    <pre
      ref={ref}
      style={{
        height: "100%",
        margin: 0,
        padding: "10px",
        overflow: "auto",
        background: "#0b1220",
        color: "#cbd5e1",
        fontSize: 12
      }}
    />
  );
}
