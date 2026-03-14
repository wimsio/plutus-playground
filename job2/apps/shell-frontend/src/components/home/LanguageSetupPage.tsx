import React, { useMemo, useState } from "react";
import type { StarterLanguage } from "../../types";
import { STARTER_LANGUAGE_META } from "../../templates/languageStarterRegistry.ts";

export function LanguageSetupPage({
  onCreateStarter,
  onSkip,
}: {
  onCreateStarter: (language: StarterLanguage) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<StarterLanguage>("haskell");

  const current = useMemo(
    () => STARTER_LANGUAGE_META.find((item) => item.id === selected) ?? STARTER_LANGUAGE_META[0],
    [selected]
  );

  return (
    <div
      style={{
        minHeight: "100%",
        padding: 28,
        background:
          "radial-gradient(circle at top left, rgba(56,189,248,0.10), transparent 28%), radial-gradient(circle at top right, rgba(167,139,250,0.10), transparent 24%)",
      }}
    >
      <div style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 24 }}>
        <div
          style={{
            borderRadius: 28,
            padding: 28,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(56,189,248,0.16)",
              color: "#7dd3fc",
              fontWeight: 800,
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            START HERE
          </div>

          <h1 style={{ margin: "0 0 10px", fontSize: 36, lineHeight: 1.1 }}>
            Choose your Cardano smart contract language
          </h1>

          <p style={{ margin: 0, color: "#cbd5e1", maxWidth: 860, fontSize: 16 }}>
            This page creates a structured starter before the main IDE workflow. Every starter includes onchain,
            onchain tests, offchain, offchain tests, frontend, and frontend tests.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px, 420px) minmax(0, 1fr)",
            gap: 22,
          }}
        >
          <div
            style={{
              borderRadius: 24,
              padding: 18,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              gap: 14,
            }}
          >
            {STARTER_LANGUAGE_META.map((item) => {
              const active = item.id === selected;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  style={{
                    textAlign: "left",
                    padding: 18,
                    borderRadius: 18,
                    border: active ? "1px solid rgba(56,189,248,0.55)" : "1px solid rgba(255,255,255,0.08)",
                    background: active ? "rgba(56,189,248,0.10)" : "rgba(255,255,255,0.02)",
                    color: "#e5e7eb",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{item.title}</div>
                  <div style={{ color: "#93c5fd", marginTop: 4, fontSize: 13 }}>{item.subtitle}</div>
                  <div style={{ color: "#cbd5e1", marginTop: 10, fontSize: 14 }}>{item.description}</div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              borderRadius: 24,
              padding: 24,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              gap: 18,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 8px" }}>{current.title}</h2>
              <p style={{ margin: 0, color: "#cbd5e1" }}>{current.description}</p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              <div
                style={{
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Included</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#cbd5e1" }}>
                  <li>Onchain</li>
                  <li>Onchain unit tests</li>
                  <li>Offchain</li>
                  <li>Offchain unit tests</li>
                  <li>Frontend</li>
                  <li>Frontend unit tests</li>
                </ul>
              </div>

              <div
                style={{
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Frontend style</div>
                <p style={{ margin: 0, color: "#cbd5e1" }}>{current.frontendStyle}</p>
              </div>
            </div>

            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Highlights</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {current.highlights.map((item) => (
                  <span
                    key={item}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 700,
                      background: "rgba(255,255,255,0.06)",
                      color: "#dbeafe",
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.18)",
                color: "#fde68a",
                fontSize: 14,
              }}
            >
              Haskell starter works with your current compile flow. Aiken, Opshin, Helios, and Midnight are scaffolded
              cleanly, but compile is not yet wired into your current backend.
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => onCreateStarter(selected)}
                style={{
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: "none",
                  fontWeight: 800,
                  cursor: "pointer",
                  background: "#38bdf8",
                  color: "#0f172a",
                }}
              >
                Create {current.title} Starter
              </button>

              <button
                onClick={onSkip}
                style={{
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontWeight: 800,
                  cursor: "pointer",
                  background: "transparent",
                  color: "#e5e7eb",
                }}
              >
                Skip to IDE Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}