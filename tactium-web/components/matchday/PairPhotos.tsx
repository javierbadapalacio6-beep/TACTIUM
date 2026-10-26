"use client";

/**
 * Fotos por pareja de la jornada: el capitán sube una foto de cada pareja y cualquiera la comparte como
 * tarjeta (foto + nombres completos + resultado + logos). Réplica de la app (`PairPhotosSection`).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { Btn, Card, CardHead } from "@/components/ui";
import { IconCamera, IconShare, IconTrash } from "@/components/Icon";
import { guardedWrite } from "@/lib/writes";
import { canNativeShare } from "@/lib/invite";
import {
  fetchPairPhotos,
  removePairPhoto,
  renderPairCard,
  uploadPairPhoto,
} from "@/lib/pair-photos";

export interface PairPhotoItem {
  court: number;
  playerA: string | null;
  playerB: string | null;
  /** Sets de la pareja: «6-4 6-3». */
  summary: string;
  won: boolean | null;
}

export function PairPhotos({
  matchdayId,
  teamId,
  canEdit,
  items,
  matchLine,
  subtitle,
  clubLogoUrl,
  onToast,
}: {
  matchdayId: string;
  teamId: string | null;
  canEdit: boolean;
  items: PairPhotoItem[];
  matchLine: string;
  subtitle: string;
  clubLogoUrl: string | null;
  onToast: (msg: string) => void;
}) {
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickingFor = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPairPhotos(matchdayId)
      .then((p) => alive && setPhotos(p))
      .catch(() => alive && setPhotos({}));
    return () => {
      alive = false;
    };
  }, [matchdayId]);

  const onFile = useCallback(
    async (file: File | undefined) => {
      const court = pickingFor.current;
      if (inputRef.current) inputRef.current.value = "";
      if (!file || court == null || !teamId) return;
      setBusy(court);
      const res = await guardedWrite("subir la foto de la pareja", () =>
        uploadPairPhoto(teamId, matchdayId, court, file),
      );
      setBusy(null);
      if (!res.ok) return onToast(res.reason);
      setPhotos((p) => ({ ...p, [court]: res.data }));
    },
    [teamId, matchdayId, onToast],
  );

  const remove = useCallback(
    async (court: number) => {
      if (!teamId) return;
      setBusy(court);
      const res = await guardedWrite("quitar la foto de la pareja", () =>
        removePairPhoto(teamId, matchdayId, court),
      );
      setBusy(null);
      if (!res.ok) return onToast(res.reason);
      setPhotos((p) => {
        const n = { ...p };
        delete n[court];
        return n;
      });
    },
    [teamId, matchdayId, onToast],
  );

  const share = useCallback(
    async (it: PairPhotoItem, url: string) => {
      setBusy(it.court);
      try {
        const blob = await renderPairCard({
          photoUrl: url,
          playerA: it.playerA ?? "Jugador A",
          playerB: it.playerB ?? "Jugador B",
          courtLabel: `P${it.court}`,
          summary: it.summary,
          won: it.won,
          matchLine,
          subtitle,
          clubLogoUrl,
        });
        const file = new File([blob], `tactium-pareja-${it.court}.jpg`, { type: "image/jpeg" });
        if (canNativeShare() && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
            return;
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
          }
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        onToast("Imagen descargada");
      } catch (e) {
        onToast((e as Error)?.message ?? "No se pudo crear la imagen");
      } finally {
        setBusy(null);
      }
    },
    [matchLine, subtitle, clubLogoUrl, onToast],
  );

  if (items.length === 0) return null;
  return (
    <Card flush>
      <CardHead title="Fotos por pareja" />
      <div className="card-body" style={{ display: "grid", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          Una foto de cada pareja con su resultado, lista para compartir (carrusel de Instagram, WhatsApp…).
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {items.map((it) => {
          const url = photos[it.court];
          const names = [it.playerA, it.playerB].filter(Boolean).join(" y ");
          return (
            <div key={it.court} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <div style={{ fontWeight: 700 }}>
                P{it.court}
                {names ? ` · ${names}` : ""}
                {it.summary ? <span className="mono" style={{ color: "var(--text-muted)" }}> · {it.summary}</span> : null}
              </div>
              {url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Foto de la pareja ${names}`}
                    style={{ display: "block", width: "100%", maxWidth: 360, aspectRatio: "4 / 5", objectFit: "cover", borderRadius: "var(--r-md)", border: "1px solid var(--line)", marginTop: 10 }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <Btn variant="accent" icon={<IconShare size={15} />} disabled={busy === it.court} onClick={() => void share(it, url)}>
                      {busy === it.court ? "Preparando…" : "Compartir pareja"}
                    </Btn>
                    {canEdit ? (
                      <>
                        <Btn
                          variant="ghost"
                          icon={<IconCamera size={15} />}
                          disabled={busy === it.court}
                          onClick={() => {
                            pickingFor.current = it.court;
                            inputRef.current?.click();
                          }}
                        >
                          Cambiar foto
                        </Btn>
                        <Btn variant="danger-ghost" icon={<IconTrash size={15} />} disabled={busy === it.court} onClick={() => void remove(it.court)}>
                          Quitar
                        </Btn>
                      </>
                    ) : null}
                  </div>
                </>
              ) : canEdit ? (
                <div style={{ marginTop: 10 }}>
                  <Btn
                    variant="ghost"
                    icon={<IconCamera size={15} />}
                    disabled={busy === it.court}
                    onClick={() => {
                      pickingFor.current = it.court;
                      inputRef.current?.click();
                    }}
                  >
                    {busy === it.court ? "Guardando…" : `Añadir foto de la pareja ${it.court}`}
                  </Btn>
                </div>
              ) : (
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-faint)" }}>Aún no hay foto de esta pareja.</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
