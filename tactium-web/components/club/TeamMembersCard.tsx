"use client";

import { useState } from "react";

import {
  createInvitation,
  fetchTeamInvitations,
  invitationActive,
} from "@/lib/queries";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import { copyText, inviteMessage, inviteUrl, whatsappShareUrl } from "@/lib/invite";
import { Avatar, Btn, Card, CardHead, Chip, Note } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { IconCopy, IconShare, IconUserPlus, IconUsers } from "@/components/Icon";

interface Member {
  userId: string;
  role: string;
  name: string;
  avatarUrl: string | null;
}

async function fetchMembers(teamId: string): Promise<Member[]> {
  const sb = supabaseBrowser();
  const { data: ms, error } = await sb
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (ms ?? []) as { user_id: string; role: string }[];
  if (rows.length === 0) return [];
  const { data: profs } = await sb
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", rows.map((r) => r.user_id));
  const byId = new Map(
    ((profs ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]),
  );
  return rows.map((r) => ({
    userId: r.user_id,
    role: r.role,
    name: byId.get(r.user_id)?.full_name || "Sin nombre",
    avatarUrl: byId.get(r.user_id)?.avatar_url ?? null,
  }));
}

/**
 * «Capitán y miembros» de un equipo, desde el club (rediseño 2026-10). Antes
 * la web no dejaba gestionar los miembros desde la vista del equipo. El
 * código de capitán es de un solo uso; la BD valida que el club es admin.
 */
export function TeamMembersCard({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [reload, setReload] = useState(0);
  const members = useAsync(() => fetchMembers(teamId), [teamId, reload]);
  const invites = useAsync(
    () => fetchTeamInvitations(teamId).catch(() => []),
    [teamId, reload],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openCaptain = (invites.data ?? []).filter((i) => i.role === "captain" && invitationActive(i));
  const code = openCaptain[0]?.code ?? null;

  async function newCaptainCode() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("crear el código de capitán", () => createInvitation(teamId, "captain"));
    setBusy(false);
    if (res.ok) setReload((k) => k + 1);
    else setErr(res.reason);
  }

  const list = members.data ?? [];
  return (
    <Card flush style={{ marginBottom: 16 }}>
      <CardHead
        title="Capitán y miembros"
        count={list.length || undefined}
        sub={
          openCaptain.length > 0
            ? `${openCaptain.length} ${openCaptain.length === 1 ? "invitación abierta" : "invitaciones abiertas"}`
            : undefined
        }
      >
        <Btn size="sm" variant="tint" icon={<IconUserPlus size={14} />} onClick={newCaptainCode} disabled={busy}>
          Invitar capitán
        </Btn>
      </CardHead>
      {code && (
        <div style={{ padding: "4px 16px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.15em" }}>
            {code}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Código de capitán · un solo uso</span>
          <span style={{ flex: 1 }} />
          <Btn
            size="sm"
            icon={<IconCopy size={14} />}
            onClick={async () => {
              const ok = await copyText(inviteUrl(code));
              setCopied(ok);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? "Copiado" : "Copiar enlace"}
          </Btn>
          <a
            className="btn btn-accent btn-sm"
            href={whatsappShareUrl(inviteMessage(teamName, code, "captain"))}
            target="_blank"
            rel="noreferrer"
          >
            <IconShare size={14} />
            Enviar por WhatsApp
          </a>
        </div>
      )}
      {err && (
        <div style={{ padding: "0 16px 12px" }}>
          <Note tone="error">{err}</Note>
        </div>
      )}
      {members.loading ? null : list.length === 0 ? (
        <EmptyState compact icon={<IconUsers size={22} />} title="Aún no hay miembros" />
      ) : (
        list.map((m) => (
          <div key={m.userId} className="list-row">
            <Avatar
              initials={m.name
                .split(/\s+/)
                .map((w) => w[0] ?? "")
                .join("")
                .slice(0, 2)
                .toUpperCase()}
              src={m.avatarUrl}
              size={30}
            />
            <span className="list-row-main">
              <span className="list-row-title truncate">{m.name}</span>
            </span>
            <Chip tone={m.role === "player" ? "mute" : "accent"}>
              {m.role === "player" ? "Jugador" : "Capitán"}
            </Chip>
          </div>
        ))
      )}
    </Card>
  );
}
