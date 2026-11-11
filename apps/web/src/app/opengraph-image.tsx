import { ImageResponse } from "next/og";
import { loadFigtree, MarkSvg } from "@/lib/og/brand-image";

export const alt = "extan: cobros en garantía por hitos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const font = await loadFigtree(600);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#08090b",
        color: "#f4f5f4",
        fontFamily: font ? "Figtree" : "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <MarkSvg width={64} />
        <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.04em" }}>extan</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <span style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.045em", maxWidth: 940 }}>
          Cobra por hitos con el pago ya asegurado.
        </span>
        <span style={{ fontSize: 30, color: "#a1a7ad" }}>Tu cliente deposita en garantía. Tú cobras cada entrega.</span>
      </div>
    </div>,
    { ...size, fonts: font ? [{ name: "Figtree", data: font, weight: 600, style: "normal" }] : undefined },
  );
}
