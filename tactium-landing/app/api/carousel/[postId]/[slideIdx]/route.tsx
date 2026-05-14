import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getPost, type Slide } from "@/lib/carousel/posts";

export const runtime = "edge";

// Renderiza UN slide del carrusel como PNG 1080x1350 (formato vertical de IG).
// Acceso: /api/carousel/welcome/0  → primer slide del post "welcome"
//         /api/carousel/welcome/3  → cuarto slide
// El user descarga right-click → "Save image as".

const W = 1080;
const H = 1350;

const COLORS = {
  bg: "#030F0F",
  accent: "#00DF82",
  accentDeep: "#03624C",
  text: "#E8F5EF",
  textMuted: "rgba(232,245,239,0.70)",
  textFaint: "rgba(232,245,239,0.50)",
};

// SVG inline del isotipo TACTIUM (vectorización fiel al PNG, transparente).
function TactiumMarkSvg({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1254 1254" fill="none">
      <g fill={COLORS.accent}>
        <path d="M565.03 889.19 c-8.82 -5.14 -17.39 -10.29 -19.23 -11.51 l-3.31 -2.08 0 -207.69 c0 -231.08 0.73 -212.22 -8.45 -214.80 -2.82 -0.73 -44.09 -1.22 -114.87 -1.22 l-110.46 0 -9.92 -18 c-5.39 -9.92 -9.67 -18.61 -9.31 -19.47 0.98 -2.45 40.41 -3.18 151.36 -2.69 l103.48 0.37 8.94 4.16 c10.53 5.02 20.21 14.57 25.59 25.47 l3.43 7.10 0.37 225.08 c0.12 123.69 -0.12 224.96 -0.61 224.84 -0.61 -0.12 -8.20 -4.29 -17.02 -9.55z" />
        <path d="M672.31 680.64 c0 -126.50 0.49 -221.65 1.22 -226.19 2.20 -15.80 13.59 -31.11 27.80 -37.84 l7.10 -3.31 129.56 -0.37 129.56 -0.24 -2.69 5.14 c-1.47 2.94 -6.25 11.76 -10.78 19.72 l-8.08 14.33 -110.58 0 c-92.70 0 -111.19 0.24 -114.75 1.71 -8.57 3.67 -7.96 -13.35 -7.96 216.02 l0 206.71 -19.59 11.27 c-10.78 6.25 -19.84 11.27 -20.21 11.27 -0.37 0 -0.61 -98.21 -0.61 -218.23z" />
        <path d="M444.17 714.93 c-0.98 -1.59 -4.16 -7.23 -7.23 -12.61 -3.06 -5.39 -6.98 -12.37 -8.69 -15.43 -2.45 -4.29 -2.82 -6 -1.84 -6.98 1.10 -1.10 10.29 -1.47 30.62 -1.47 l29.27 0 -0.37 19.35 -0.37 19.23 -19.84 0.37 c-19.47 0.24 -19.84 0.24 -21.55 -2.45z" />
        <path d="M769.91 716.76 c-0.49 -0.37 -0.86 -9.18 -0.86 -19.59 l0 -18.74 30.74 0 c28.78 0 30.74 0.12 29.88 2.20 -0.37 1.10 -5.27 9.92 -10.65 19.59 l-9.92 17.39 -19.23 0 c-10.53 0 -19.59 -0.37 -19.96 -0.86z" />
        <path d="M371.06 572.87 c-4.29 -7.59 -9.06 -16.16 -10.65 -19.10 -2.20 -3.92 -2.57 -5.27 -1.35 -5.76 0.86 -0.37 29.51 -0.73 63.68 -0.86 l62.21 -0.37 0.61 4.90 c0.37 2.69 0.61 11.51 0.37 19.59 l-0.37 14.70 -53.52 0.37 -53.39 0.24 -7.59 -13.72z" />
        <path d="M769.05 566.38 l0 -20.21 64.29 0 c35.39 0 64.29 0.37 64.29 0.73 0 0.49 -4.78 9.55 -10.65 20.21 l-10.78 19.47 -53.52 0 -53.64 0 0 -20.21z" />
        <path d="M281.66 312.28 l0 -20.82 345.34 0 345.34 0 0 20.82 0 20.82 -345.34 0 -345.34 0 0 -20.82z" />
      </g>
    </svg>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: "0.28em",
        color: COLORS.accent,
        textTransform: "uppercase",
        display: "flex",
      }}
    >
      {children}
    </div>
  );
}

function renderSlide(
  slide: Slide,
  slideIdx: number,
  totalSlides: number,
  origin: string,
) {
  const containerBase = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between" as const,
    padding: "100px 80px",
    background: `radial-gradient(120% 80% at 80% 20%, rgba(0,223,130,0.15) 0%, rgba(3,15,15,0) 50%), ${COLORS.bg}`,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: COLORS.text,
    position: "relative" as const,
  };

  // Grid sutil de fondo (común a todas las variantes).
  const gridLayer = (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "linear-gradient(rgba(232,245,239,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(232,245,239,0.04) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        maskImage: "radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, transparent 70%)",
      }}
    />
  );

  // Footer común — pagination dots + isotipo pequeño.
  const footer = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 1,
        width: "100%",
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === slideIdx ? 32 : 10,
              height: 10,
              borderRadius: 5,
              background: i === slideIdx ? COLORS.accent : "rgba(232,245,239,0.20)",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <TactiumMarkSvg size={36} />
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.32em",
            color: COLORS.textFaint,
          }}
        >
          TACTIUM
        </div>
      </div>
    </div>
  );

  if (slide.kind === "cover") {
    return (
      <div style={containerBase}>
        {gridLayer}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, zIndex: 1 }}>
          {slide.eyebrow && <Eyebrow>{slide.eyebrow}</Eyebrow>}
          <TactiumMarkSvg size={140} />
        </div>
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: "-0.04em",
            color: COLORS.text,
            zIndex: 1,
            display: "flex",
          }}
        >
          {slide.title}
        </div>
        {footer}
      </div>
    );
  }

  if (slide.kind === "content") {
    return (
      <div style={containerBase}>
        {gridLayer}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, zIndex: 1 }}>
          {slide.eyebrow && <Eyebrow>{slide.eyebrow}</Eyebrow>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 32, zIndex: 1 }}>
          {slide.title && (
            <div
              style={{
                fontSize: 76,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: COLORS.text,
                display: "flex",
              }}
            >
              {slide.title}
            </div>
          )}
          {slide.body && (
            <div
              style={{
                fontSize: 36,
                fontWeight: 400,
                color: COLORS.textMuted,
                lineHeight: 1.4,
                display: "flex",
              }}
            >
              {slide.body}
            </div>
          )}
        </div>
        {footer}
      </div>
    );
  }

  if (slide.kind === "stat") {
    return (
      <div style={containerBase}>
        {gridLayer}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, zIndex: 1 }}>
          {slide.eyebrow && <Eyebrow>{slide.eyebrow}</Eyebrow>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 32, zIndex: 1, alignItems: "flex-start" }}>
          {slide.stat && (
            <div
              style={{
                fontSize: 220,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.05em",
                color: COLORS.accent,
                fontFamily: "monospace",
                display: "flex",
              }}
            >
              {slide.stat}
            </div>
          )}
          {slide.statLabel && (
            <div
              style={{
                fontSize: 36,
                fontWeight: 500,
                color: COLORS.textMuted,
                display: "flex",
              }}
            >
              {slide.statLabel}
            </div>
          )}
        </div>
        {footer}
      </div>
    );
  }

  if (slide.kind === "quote") {
    return (
      <div style={containerBase}>
        {gridLayer}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, zIndex: 1 }}>
          {slide.eyebrow && <Eyebrow>{slide.eyebrow}</Eyebrow>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, zIndex: 1 }}>
          {slide.quote && (
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                color: COLORS.text,
                display: "flex",
              }}
            >
              {`"${slide.quote}"`}
            </div>
          )}
          {slide.attribution && (
            <div
              style={{
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: "0.2em",
                color: COLORS.textFaint,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              — {slide.attribution}
            </div>
          )}
        </div>
        {footer}
      </div>
    );
  }

  if (slide.kind === "image-overlay") {
    const imageUrl = slide.imagePath
      ? new URL(slide.imagePath, origin).toString()
      : "";
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: COLORS.text,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          width={W}
          height={H}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Vignette + gradient para legibilidad del texto inferior */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(3,15,15,0.10) 0%, rgba(3,15,15,0.05) 45%, rgba(3,15,15,0.85) 88%, rgba(3,15,15,0.96) 100%)",
          }}
        />
        {/* Bloque de texto inferior */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "80px 80px 60px 80px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {slide.eyebrow && <Eyebrow>{slide.eyebrow}</Eyebrow>}
          {slide.title && (
            <div
              style={{
                fontSize: 78,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: COLORS.text,
                display: "flex",
                textShadow: "0 2px 24px rgba(0,0,0,0.45)",
              }}
            >
              {slide.title}
            </div>
          )}
          {/* Footer compacto: pagination + isotipo */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              {Array.from({ length: totalSlides }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === slideIdx ? 32 : 10,
                    height: 10,
                    borderRadius: 5,
                    background:
                      i === slideIdx
                        ? COLORS.accent
                        : "rgba(232,245,239,0.40)",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <TactiumMarkSvg size={32} />
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "0.32em",
                  color: COLORS.text,
                }}
              >
                TACTIUM
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CTA
  return (
    <div style={containerBase}>
      {gridLayer}
      <div style={{ display: "flex", flexDirection: "column", gap: 24, zIndex: 1 }}>
        {slide.eyebrow && <Eyebrow>{slide.eyebrow}</Eyebrow>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 40, zIndex: 1, alignItems: "flex-start" }}>
        {slide.title && (
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: COLORS.text,
              display: "flex",
            }}
          >
            {slide.title}
          </div>
        )}
        {slide.cta && (
          <div
            style={{
              padding: "22px 44px",
              borderRadius: 999,
              background: COLORS.accent,
              color: "#001810",
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              display: "flex",
            }}
          >
            {slide.cta}
          </div>
        )}
        {slide.url && (
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "0.15em",
              color: COLORS.textFaint,
              fontFamily: "monospace",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            {slide.url}
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string; slideIdx: string }> },
) {
  const { postId, slideIdx } = await params;
  const post = getPost(postId);
  if (!post) {
    return new Response("Post not found", { status: 404 });
  }
  const idx = parseInt(slideIdx, 10);
  const slide = post.slides[idx];
  if (!slide) {
    return new Response("Slide not found", { status: 404 });
  }

  // Origin para que el renderer pueda resolver imagePath relativos
  // (`/social/avatar/xxx.png` → `https://tactium.io/social/avatar/xxx.png`).
  // En dev sale `http://localhost:3000`, en prod el dominio real.
  const origin = req.nextUrl.origin;

  return new ImageResponse(
    renderSlide(slide, idx, post.slides.length, origin),
    { width: W, height: H },
  );
}
