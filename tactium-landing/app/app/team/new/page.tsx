"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { TactiumMark } from "@/components/TactiumMark";
import { FederationSelect } from "@/app/app/create/FederationSelect";
import { Reveal } from "@/app/app/ui/Reveal";
import {
  CATS,
  GENDERS,
  GROUPS,
  type Federation,
  type TeamGender,
} from "@/app/app/create/federations";

interface InsertedTeam {
  id: string;
}

// Crear equipo independiente (espejo de CreateTeamScreen móvil). Reverse
// trial: el equipo se crea directo — la RLS / trigger DB permiten el primer
// equipo sin sub. En web NO hay paywall; simplemente se crea.
export default function CreateTeamPage() {
  const session = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [federation, setFederation] = useState<Federation | null>(null);
  const [league, setLeague] = useState("");
  const [cat, setCat] = useState("2ª");
  const [gender, setGender] = useState<TeamGender>("masculino");
  const [hasGroup, setHasGroup] = useState(false);
  const [group, setGroup] = useState("A");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(
    () => Boolean(name.trim() && federation && cat && (!hasGroup || group)),
    [name, federation, cat, group, hasGroup],
  );

  const handleCreate = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const { data, error: insErr } = await getSupabaseApp()
      .from("teams")
      .insert({
        owner_id: session.user.id,
        name: name.trim(),
        federation: federation?.code ?? null,
        league: league.trim() || null,
        category: cat || null,
        group_name: hasGroup ? group || null : null,
        gender,
        club_id: null,
      })
      .select("id")
      .single();
    if (insErr) {
      setError(insErr.message);
      setSubmitting(false);
      return;
    }
    const created = data as InsertedTeam;
    router.push(`/app/team/${created.id}`);
  };

  const previewMeta =
    [cat, hasGroup && `Grupo ${group}`, league.trim()]
      .filter(Boolean)
      .join(" · ") || "Configura la categoría";

  return (
    <>
      <Reveal>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
        >
          <span>←</span> EQUIPOS
        </Link>

        <div className="mb-7">
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
            NUEVO EQUIPO
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Crea tu equipo
          </h1>
          <p className="text-[14px] text-[var(--color-text-muted)] mt-2 max-w-md">
            Configura los datos de la competición. Lo podrás editar después.
          </p>
        </div>
      </Reveal>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      <Reveal
        delay={80}
        className="max-w-xl rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-6"
      >
        <Field label="Nombre del equipo">
          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card-2)] px-3.5 py-3">
            <span className="w-[5px] h-5 rounded bg-[var(--color-accent)] shrink-0" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Padel Club"
              maxLength={50}
              autoFocus
              className="flex-1 bg-transparent outline-none text-[16px] font-semibold placeholder:text-[var(--color-text-faint)]"
            />
          </div>
        </Field>

        <Field label="Federación">
          <FederationSelect value={federation} onChange={setFederation} />
        </Field>

        <Field label="Liga · Opcional">
          <input
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            placeholder="Liga por equipos absoluta"
            className="w-full rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card-2)] px-3.5 py-3 text-[14px] font-medium outline-none placeholder:text-[var(--color-text-faint)]"
          />
        </Field>

        <Field label="Categoría">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {CATS.map((c) => {
              const sel = cat === c;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`shrink-0 w-14 h-12 rounded-xl border text-[17px] font-semibold transition ${
                    sel
                      ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-black"
                      : "bg-[var(--color-bg-card-2)] border-[var(--color-hair-strong)] text-[var(--color-text)] hover:border-[var(--color-accent-40)]"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Género">
          <div className="flex gap-1.5">
            {GENDERS.map((g) => {
              const sel = gender === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id)}
                  className={`flex-1 h-12 rounded-xl border text-[14px] font-semibold transition ${
                    sel
                      ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-black"
                      : "bg-[var(--color-bg-card-2)] border-[var(--color-hair-strong)] text-[var(--color-text)] hover:border-[var(--color-accent-40)]"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-faint)] uppercase">
              Grupo
            </span>
            <button
              onClick={() => setHasGroup((v) => !v)}
              className={`font-mono text-[11px] px-2.5 py-1 rounded-full border transition ${
                hasGroup
                  ? "text-[var(--color-accent)] border-[var(--color-accent-40)]"
                  : "text-[var(--color-text-muted)] border-[var(--color-hair-strong)]"
              }`}
            >
              {hasGroup ? "Sí" : "Sin grupos"}
            </button>
          </div>
          {hasGroup && (
            <div className="flex gap-1.5">
              {GROUPS.map((g) => {
                const sel = group === g;
                return (
                  <button
                    key={g}
                    onClick={() => setGroup(g)}
                    className={`flex-1 h-12 rounded-xl border text-[17px] font-semibold transition ${
                      sel
                        ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-black"
                        : "bg-[var(--color-bg-card-2)] border-[var(--color-hair-strong)] text-[var(--color-text)] hover:border-[var(--color-accent-40)]"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="mt-6 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card-2)] p-4">
          <div className="flex items-center gap-3">
            <TactiumMark size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold tracking-tight truncate">
                {name.trim() || "Sin nombre"}
              </p>
              <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                {previewMeta}
              </p>
            </div>
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
          </div>
          {federation && (
            <p className="mt-3 pt-3 border-t border-[var(--color-hair)] font-mono text-[10px] tracking-wide text-[var(--color-text-faint)]">
              {federation.shortName} · {federation.region}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6">
          <Link
            href="/app"
            className="flex-1 h-12 grid place-items-center rounded-xl border border-[var(--color-hair-strong)] text-[14px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
          >
            Cancelar
          </Link>
          <button
            onClick={handleCreate}
            disabled={!valid || submitting}
            className="flex-[1.5] h-12 rounded-xl bg-[var(--color-accent)] text-black text-[15px] font-bold transition hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? "Creando…" : "Crear equipo"}
          </button>
        </div>
      </Reveal>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-faint)] uppercase mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}
