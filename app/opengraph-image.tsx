import { ImageResponse } from "next/og";

export const alt = "Tallyhawk — AI-powered financial document automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#000000",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 36 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              background: "linear-gradient(135deg, #6366f1, #10b981)",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 48, fontWeight: 700, color: "#ffffff", display: "flex" }}>
            Tallyhawk
          </div>
        </div>
        <div style={{ fontSize: 32, color: "#9ca3af", maxWidth: 820, display: "flex" }}>
          AI-powered financial document automation
        </div>
        <div style={{ fontSize: 22, color: "#4b5563", marginTop: 44, display: "flex" }}>
          Extract invoices &amp; receipts · Sync to QuickBooks · Tax-ready exports
        </div>
      </div>
    ),
    { ...size }
  );
}
