import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          fontFamily: "Geist, system-ui, sans-serif",
          background:
            "radial-gradient(900px 600px at 12% -10%, rgba(44, 76, 184, 0.35), transparent 60%), radial-gradient(900px 600px at 95% 8%, rgba(90, 125, 240, 0.18), transparent 65%), #060810",
          color: "#e8eaf6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "linear-gradient(180deg, #16306a, #0a1233)",
              border: "1px solid rgba(90,125,240,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              fontSize: 30,
              color: "#d6e0ff",
            }}
          >
            ɘ
          </div>
          <div style={{ fontSize: 30, letterSpacing: "-0.01em", fontWeight: 600 }}>engram</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 18,
              fontFamily: "ui-monospace, monospace",
              color: "#8aa6ff",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            recursive language model · for claude code · v0.0.1
          </div>
          <div style={{ fontSize: 68, letterSpacing: "-0.03em", lineHeight: 1.03, fontWeight: 600, maxWidth: 1000 }}>
            The codebase is never loaded into context.
          </div>
          <div style={{ fontSize: 24, color: "rgba(232,234,246,0.66)", maxWidth: 900, lineHeight: 1.4 }}>
            Claude examines it via a logged REPL of five primitives. Verifiable, local-first, infinite-feeling.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "ui-monospace, monospace",
            fontSize: 16,
            color: "rgba(232,234,246,0.42)",
          }}
        >
          <div>grep · read · ast · git · recurse</div>
          <div>engram.app</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
