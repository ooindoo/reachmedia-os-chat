import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 192,
        height: 192,
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: "#CCFF00",
          fontSize: 132,
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
