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
          padding: "72px 80px",
          fontFamily: "Georgia, 'Source Serif', serif",
          background: "#070707",
          color: "rgba(245, 245, 246, 0.96)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 9,
              background: "#000",
              border: "1px solid rgba(255, 255, 255, 0.32)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              fontSize: 26,
              color: "#fff",
            }}
          >
            ɘ
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 500,
              fontFamily: "system-ui, sans-serif",
              color: "rgba(245, 245, 246, 0.96)",
            }}
          >
            engram
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 980 }}>
          <div style={{ fontSize: 72, letterSpacing: "-0.025em", lineHeight: 1.05, fontWeight: 600 }}>
            A Recursive Language Model engine for Claude Code.
          </div>
          <div
            style={{
              fontSize: 26,
              fontStyle: "italic",
              color: "rgba(245, 245, 246, 0.66)",
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            The codebase isn&apos;t loaded into context. Claude examines it through five logged primitives.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "ui-monospace, monospace",
            fontSize: 15,
            color: "rgba(245, 245, 246, 0.42)",
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
