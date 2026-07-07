"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { TactiumMark } from "@/components/TactiumMark";
import { FederationSelect } from "@/app/app/create/FederationSelect";
import { type Federation } from "@/app/app/create/federations";
import { Reveal } from "@/app/app/ui/Reveal";

interface InsertedClub {
  id: string;
}

// Crear club (espejo de CreateClubScreen móvil). El owner se convierte en
// club_admin automáticamente vía triggers DB. En web no hay paywall; tras
// crear el club, llevamos a su detalle para añadir equipos.
export default function CreateClubPage() {
  const session = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [federation, setFederation] = useState<Federation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(
    () => Boolean(name.trim() && federation),
    [name, federation],
  );

  const handleCreate = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const { data, error: insErr } = await getSupabaseApp()
      .from("clubs")
      .insert({
        owner_id: session.user.id,
        name: name.trim(),
        federation: federation?.code ?? null,
      })
      .select("id")
      .single();
    if (insErr) {
      setError(insErr.message);
      setSubmitting(false);
      return;
    }
    const created = data as InsertedClub;
    router.push(`/app/club/${created.id}`);
  };

  return (
    <>
      <Link
        href="/app/club"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
      >
        <span>←</span> CLUBES
      </Link>

      <Reveal className="mb-7">
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
          NUEVO CLUB
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">Crea tu club</h1>
        <p className="text-[14px] text-[var(--color-text-muted)] mt-2 max-w-md">
          Empieza por la entidad. Después podrás añadir equipos y asignar
          capitanes.
        </p>
      </Reveal>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      <Reveal
        as="div"
        delay={60}
        className="max-w-xl rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-6"
      >
        <Field label="Nombre del club">
          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card-2)] px-3.5 py-3">
            <span className="w-[5px] h-5 rounded bg-[var(--color-accent)] shrink-0" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Padel Club"
              maxLength={60}
              autoFocus
              className="flex-1 bg-transparent outline-none text-[16px] font-semibold placeholder:text-[var(--color-text-faint)]"
            />
          </div>
        </Field>

        <Field label="Federación">
          <FederationSelect value={federation} onChange={setFederation} />
        </Field>

        {/* Preview */}
        <div className="mt-6 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card-2)] p-4">
          <div className="flex items-center gap-3">
            <TactiumMark size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold tracking-tight truncate">
                {name.trim() || "Sin nombre"}
              </p>
              <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                {federation
                  ? `${federation.shortName} · ${federation.region}`
                  : "Sin federación"}
              </p>
            </div>
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
          </div>
          <p className="mt-3 pt-3 border-t border-[var(--color-hair)] font-mono text-[10px] tracking-wide text-[var(--color-text-faint)]">
            Después: tus capitanes alinean en 90 segundos.
          </p>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <Link
            href="/app/club"
            className="flex-1 h-12 grid place-items-center rounded-xl border border-[var(--color-hair-strong)] text-[14px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
          >
            Cancelar
          </Link>
          <button
            onClick={handleCreate}
            disabled={!valid || submitting}
            className="flex-[1.5] h-12 rounded-xl bg-[var(--color-accent)] text-black text-[15px] font-bold transition hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? "Creando…" : "Crear club"}
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
