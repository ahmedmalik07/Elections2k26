import { ImageResponse } from "next/og";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#FFC20E",
        color: "#1D2A5C",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 140,
        fontWeight: 900,
        border: "24px solid #E4312B",
      }}
    >
      JC
    </div>,
    size,
  );
}
