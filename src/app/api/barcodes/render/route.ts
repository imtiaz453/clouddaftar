import bwipjs from "bwip-js";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "NO-DATA";
  const symbology = searchParams.get("symbology") || "code128";
  const scale = parseInt(searchParams.get("scale") || "2");
  const height = parseInt(searchParams.get("height") || "30");

  try {
    const svg = bwipjs.toSVG({
      bcid: symbology,
      text,
      scaleX: scale,
      scaleY: scale,
      height,
      includetext: true,
      textxalign: "center",
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    // Fallback: generate a simple placeholder SVG
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
      <rect width="100%" height="100%" fill="#f3f4f6" rx="4"/>
      <text x="100" y="24" text-anchor="middle" font-family="monospace" font-size="11" fill="#6b7280">${text}</text>
      <text x="100" y="42" text-anchor="middle" font-family="monospace" font-size="9" fill="#9ca3af">Invalid ${symbology}</text>
    </svg>`;

    return new Response(fallback, {
      headers: { "Content-Type": "image/svg+xml" },
      status: 200,
    });
  }
}
