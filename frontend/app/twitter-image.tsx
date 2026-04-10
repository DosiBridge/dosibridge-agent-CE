import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0b1020 0%, #111827 45%, #0f172a 100%)",
          color: "#f8fafc",
        }}
      >
        <div style={{ fontSize: 34, color: "#22d3ee", fontWeight: 700, marginBottom: "14px" }}>
          DosiBridge Agent
        </div>
        <div style={{ fontSize: 82, fontWeight: 800, lineHeight: 1.02, marginBottom: "20px" }}>
          Enterprise AI
          <br />
          Assistant
        </div>
        <div style={{ fontSize: 33, color: "#cbd5e1", maxWidth: "980px" }}>
          Ask, analyze, and automate with secure retrieval-augmented generation.
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
