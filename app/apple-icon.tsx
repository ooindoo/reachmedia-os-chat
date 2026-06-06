import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: "#CCFF00",
          fontSize: 124,
          fontWeight: 900,
          lineHeight: 1,
          fontFamily: "system-ui, -apple-system, Arial, sans-serif",
        }}
      >
        R
      </div>
    </div>,
    { ...size }
  );
}
