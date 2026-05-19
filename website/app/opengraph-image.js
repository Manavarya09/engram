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
            "radial-gradient(900px 600px at 12% -10%, rgba(27, 107, 72, 0.38), transparent 60%), radial-gradient(900px 600px at 95% 8%, rgba(78, 196, 145, 0.18), transparent 65%), #050b08",
          color: "#e8f0ea",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "linear-gradient(180deg, #0d3220, #02160c)",
              border: "1px solid rgba(78, 196, 145, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              fontSize: 30,
              color: "#d8f5e6",
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
              color: "#a3eec9",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            recursive language model · claude code · v0.0.1
          </div>
          <div style={{ fontSize: 68, letterSpacing: "-0.03em", lineHeight: 1.03, fontWeight: 600, maxWidth: 1000 }}>
            The codebase is never loaded into context.
          </div>
          <div style={{ fontSize: 24, color: "rgba(232, 240, 234, 0.64)", maxWidth: 900, lineHeight: 1.4 }}>
            Claude examines it through five primitives. Every call appends to a sha256-hashed local journal.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "ui-monospace, monospace",
            fontSize: 16,
            color: "rgba(232, 240, 234, 0.42)",
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
