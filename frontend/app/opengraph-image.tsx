import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
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
          padding: "64px",
          background:
            "radial-gradient(circle at 20% 20%, #0ea5e9 0%, #0b1020 38%), linear-gradient(140deg, #0b1020 0%, #070b16 100%)",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "999px",
              background: "#22d3ee",
              boxShadow: "0 0 28px #22d3ee",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700 }}>DosiBridge</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1.05 }}>
            DosiBridge Agent
          </div>
          <div style={{ fontSize: 34, color: "#cbd5e1", maxWidth: "980px" }}>
            Enterprise AI assistant with secure RAG, document intelligence, and workflow automation.
          </div>
        </div>

        <div style={{ fontSize: 28, color: "#22d3ee", fontWeight: 600 }}>
          agent.dosibridge.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
