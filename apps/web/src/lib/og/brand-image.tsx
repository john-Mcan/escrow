import { MARK_CORE, MARK_LEFT_BRACKET, MARK_RIGHT_BRACKET } from "@/components/brand";

/** Figtree para imágenes generadas (Satori no lee woff2: se pide el CSS sin user agent, que entrega TrueType). */
export async function loadFigtree(weight: 500 | 600): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Figtree:wght@${weight}`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
    }).then((response) => response.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await fetch(url).then((response) => response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export function MarkSvg({ width }: { width: number }) {
  return (
    <svg width={width} height={(width * 32) / 40} viewBox="0 0 40 32">
      <path d={MARK_LEFT_BRACKET} fill="none" stroke="#f4f5f4" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={MARK_RIGHT_BRACKET} fill="none" stroke="#f4f5f4" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={MARK_CORE.x} y={MARK_CORE.y} width={MARK_CORE.size} height={MARK_CORE.size} rx={MARK_CORE.radius} fill="#7de7bb" />
    </svg>
  );
}
