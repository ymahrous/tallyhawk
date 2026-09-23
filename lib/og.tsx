import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_COLORS, logoSvg } from "@/lib/brand";
import { PRODUCT_FACTS } from "@/lib/site";

// Shared renderer for every route's opengraph-image.tsx. Images are generated at build time
// (no request-time APIs), so reading the bundled Inter files from disk is safe.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

interface OgImageOptions {
  eyebrow: string;
  title: string;
  description: string;
  /** Show the extracted-receipt card on the right; off for text-heavy pages like legal. */
  showProductCard?: boolean;
}

let fontsPromise: Promise<
  { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[]
> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all(
    (
      [
        ["Inter-Regular.ttf", 400],
        ["Inter-SemiBold.ttf", 600],
        ["Inter-Bold.ttf", 700],
      ] as const
    ).map(async ([file, weight]) => ({
      name: "Inter",
      data: await readFile(join(process.cwd(), "assets/fonts", file)),
      weight,
      style: "normal" as const,
    }))
  );
  return fontsPromise;
}

const toDataUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const LOGO_DATA_URI = toDataUri(logoSvg());

// Glows and grid are drawn as SVG because Satori's CSS radial-gradient support is incomplete.
const BACKGROUND_DATA_URI = toDataUri(
  [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE.width}" height="${OG_SIZE.height}" viewBox="0 0 ${OG_SIZE.width} ${OG_SIZE.height}">`,
    "<defs>",
    `<radialGradient id="indigo" cx="1030" cy="70" r="560" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${BRAND_COLORS.indigo}" stop-opacity="0.45"/><stop offset="1" stop-color="${BRAND_COLORS.indigo}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="emerald" cx="90" cy="640" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${BRAND_COLORS.emerald}" stop-opacity="0.25"/><stop offset="1" stop-color="${BRAND_COLORS.emerald}" stop-opacity="0"/></radialGradient>`,
    `<pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#FFFFFF" stroke-opacity="0.045"/></pattern>`,
    "</defs>",
    `<rect width="100%" height="100%" fill="${BRAND_COLORS.ink}"/>`,
    `<rect width="100%" height="100%" fill="url(#grid)"/>`,
    `<rect width="100%" height="100%" fill="url(#indigo)"/>`,
    `<rect width="100%" height="100%" fill="url(#emerald)"/>`,
    "</svg>",
  ].join("")
);
const MUTED = "#9CA3AF";
const FAINT = "#6B7280";
const BORDER = "rgba(255,255,255,0.12)";

function Chip({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px",
        borderRadius: 999,
        border: `1px solid ${BORDER}`,
        background: "rgba(255,255,255,0.04)",
        color: "#E5E7EB",
        fontSize: 20,
        fontWeight: 600,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 999, background: BRAND_COLORS.emerald }} />
      {label}
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 15, letterSpacing: 2, color: FAINT, fontWeight: 600 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent ? "#34D399" : "#FFFFFF" }}>
        {value}
      </div>
    </div>
  );
}

function ProductCard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 380,
        padding: 30,
        gap: 24,
        borderRadius: 28,
        border: `1px solid ${BORDER}`,
        background: "linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#FFFFFF" }}>receipt_hw.jpg</div>
          <div style={{ fontSize: 16, color: FAINT }}>Extracted by AI</div>
        </div>
        <div
          style={{
            display: "flex",
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(16,185,129,0.15)",
            color: "#34D399",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Completed
        </div>
      </div>
      <div style={{ display: "flex", height: 1, background: BORDER }} />
      <Field label="Vendor" value="Apple Store" />
      <div style={{ display: "flex", gap: 40 }}>
        <Field label="Amount" value="$224.08" accent />
        <Field label="Category" value="Equipment" />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: 16,
          background: "rgba(99,102,241,0.14)",
          color: "#C7D2FE",
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        <div
          style={{ width: 10, height: 10, borderRadius: 999, background: BRAND_COLORS.emerald }}
        />
        Synced to QuickBooks Online
      </div>
    </div>
  );
}

export async function renderOgImage({
  eyebrow,
  title,
  description,
  showProductCard = true,
}: OgImageOptions) {
  const fonts = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: BRAND_COLORS.ink,
        fontFamily: "Inter",
        color: "#FFFFFF",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        src={BACKGROUND_DATA_URI}
        width={OG_SIZE.width}
        height={OG_SIZE.height}
        style={{ position: "absolute", top: 0, left: 0 }}
      />

      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            height: "100%",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={LOGO_DATA_URI} width={56} height={56} />
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>Tallyhawk</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 3,
                color: "#A5B4FC",
              }}
            >
              {eyebrow.toUpperCase()}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: showProductCard ? 60 : 72,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: -2,
                maxWidth: showProductCard ? 640 : 960,
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                lineHeight: 1.4,
                color: MUTED,
                maxWidth: showProductCard ? 620 : 900,
              }}
            >
              {description}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14 }}>
            <Chip label="AI extraction" />
            <Chip label="QuickBooks sync" />
            <Chip label={`${PRODUCT_FACTS.currencyCount} currencies`} />
          </div>
        </div>

        {showProductCard && <ProductCard />}
      </div>
    </div>,
    { ...OG_SIZE, fonts }
  );
}
