import { POSTS } from "@/lib/carousel/posts";
import { notFound } from "next/navigation";

// Dashboard interno para previsualizar y descargar todos los slides de
// todos los carruseles definidos en lib/carousel/posts.ts.
//
// Solo disponible en development. En producción → 404.

export default function CarouselDevPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen px-6 py-12 max-w-6xl mx-auto">
      <div className="mb-12">
        <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
          DEV · CAROUSEL FACTORY
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Carruseles para Instagram
        </h1>
        <p className="mt-3 text-[var(--color-text-muted)] max-w-2xl">
          {POSTS.length} {POSTS.length === 1 ? "post" : "posts"} definidos en
          {" "}
          <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-card)]">
            lib/carousel/posts.ts
          </code>
          . Click derecho sobre cualquier slide → &quot;Guardar imagen como…&quot;
          para descargarlo en PNG 1080×1350.
        </p>
      </div>

      <div className="flex flex-col gap-16">
        {POSTS.map((post) => (
          <section key={post.id} className="flex flex-col gap-6">
            <header>
              <h2 className="text-2xl font-bold tracking-tight">
                {post.internalTitle}
              </h2>
              <p className="font-mono text-xs text-[var(--color-text-faint)] mt-1">
                /{post.id} · {post.slides.length} slides
              </p>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {post.slides.map((_, i) => (
                <a
                  key={i}
                  href={`/api/carousel/${post.id}/${i}`}
                  download={`tactium-${post.id}-slide-${i + 1}.png`}
                  className="group relative aspect-[1080/1350] rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-hair)] overflow-hidden hover:border-[var(--color-accent-40)] transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/carousel/${post.id}/${i}`}
                    alt={`Slide ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 font-mono text-[10px] tracking-widest px-2 py-1 rounded bg-[var(--color-bg)]/70 backdrop-blur-sm">
                    {String(i + 1).padStart(2, "0")} / {String(post.slides.length).padStart(2, "0")}
                  </div>
                </a>
              ))}
            </div>

            <details className="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-hair)] p-4">
              <summary className="cursor-pointer font-mono text-xs tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                Caption + hashtags listos para copiar
              </summary>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-faint)] mb-2">
                    CAPTION
                  </p>
                  <pre className="whitespace-pre-wrap text-sm font-sans text-[var(--color-text-muted)] bg-[var(--color-bg-raised)] p-3 rounded">
                    {post.caption}
                  </pre>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-[var(--color-text-faint)] mb-2">
                    HASHTAGS
                  </p>
                  <pre className="whitespace-pre-wrap text-sm font-sans text-[var(--color-text-muted)] bg-[var(--color-bg-raised)] p-3 rounded">
                    {post.hashtags.map((h) => `#${h}`).join(" ")}
                  </pre>
                </div>
              </div>
            </details>
          </section>
        ))}

        {/* ─── Sección extra · Reels (videos) ────────────────────── */}
        <section className="flex flex-col gap-6">
          <header>
            <h2 className="text-2xl font-bold tracking-tight">
              Reels · video con TACTIUM-Pro
            </h2>
            <p className="font-mono text-xs text-[var(--color-text-faint)] mt-1">
              MP4 9:16 generados con HIGGSFIELD kling3_0 · listos para IG Reel
              + TikTok. Click derecho sobre el video → &quot;Guardar como…&quot;.
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative aspect-[1080/1350] rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-hair)] overflow-hidden">
              <video
                src="/social/avatar/reel-lineup.mp4"
                controls
                playsInline
                loop
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 font-mono text-[10px] tracking-widest px-2 py-1 rounded bg-[var(--color-bg)]/70 backdrop-blur-sm">
                01 · LINEUP
              </div>
              <a
                href="/social/avatar/reel-lineup.mp4"
                download="tactium-reel-lineup.mp4"
                className="absolute bottom-2 right-2 font-mono text-[10px] tracking-widest px-2 py-1 rounded bg-[var(--color-accent)] text-[var(--color-text-inverse)]"
              >
                ↓ DESCARGAR
              </a>
            </div>
          </div>

          <details className="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-hair)] p-4">
            <summary className="cursor-pointer font-mono text-xs tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              Caption sugerido para IG Reel
            </summary>
            <pre className="mt-4 whitespace-pre-wrap text-sm font-sans text-[var(--color-text-muted)] bg-[var(--color-bg-raised)] p-3 rounded">
{`Cuando el partido empieza antes del primer punto.

Mientras los demás aún discuten el orden, tú ya tienes la alineación. 30 segundos. Auto-balance por puntos FEP.

Pre-lanzamiento abierto. Link en bio.

#padelfederado #fep #capitanpadel #padelclub #padelespaña #reels`}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}
