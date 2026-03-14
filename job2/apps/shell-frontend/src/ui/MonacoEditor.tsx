import React, { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import { LanguageMode } from "../types";

export function MonacoEditor({
  value,
  language,
  theme,
  onChange,
  onCursor,
  gotoLine,
}: {
  value: string;
  language: LanguageMode;
  theme: "dark" | "light";
  onChange: (v: string) => void;
  onCursor: (line: number, column: number) => void;
  gotoLine?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Prevent feedback loops when we setValue programmatically
  const applyingExternalValueRef = useRef(false);

  useEffect(() => {
    if (!mountRef.current) return;

    const ed = monaco.editor.create(mountRef.current, {
      value,
      language,
      automaticLayout: true,
      theme: theme === "dark" ? "vs-dark" : "vs",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
    });

    editorRef.current = ed;

    const sub = ed.onDidChangeModelContent(() => {
      if (applyingExternalValueRef.current) return;
      onChange(ed.getValue());
    });

    const cursorSub = ed.onDidChangeCursorPosition((e) =>
      onCursor(e.position.lineNumber, e.position.column)
    );

    return () => {
      sub.dispose();
      cursorSub.dispose();
      ed.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;

    // Theme + language
    const model = ed.getModel();
    if (model) monaco.editor.setModelLanguage(model, language);
    monaco.editor.setTheme(theme === "dark" ? "vs-dark" : "vs");

    // Content sync (guarded)
    const current = ed.getValue();
    if (current !== value) {
      applyingExternalValueRef.current = true;
      ed.setValue(value);
      applyingExternalValueRef.current = false;
    }
  }, [value, language, theme]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !gotoLine) return;
    ed.revealLineInCenter(gotoLine);
    ed.setPosition({ lineNumber: gotoLine, column: 1 });
    ed.focus();
  }, [gotoLine]);

  /**
   * IMPORTANT for your overlay issue:
   * Wrap Monaco in a positioned container with overflow hidden,
   * so Monaco's internal layers can't visually overlap your tabs/terminal.
   */
  return (
    <div className="monacoWrap" ref={containerRef}>
      <div ref={mountRef} className="monacoMount" />
    </div>
  );
}