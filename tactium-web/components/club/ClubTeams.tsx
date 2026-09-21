"use client";

import Link from "next/link";
import { useState } from "react";

import { fetchClubTeams } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import {
  BtnLink,
  Card,
  Chip,
  IconTile,
  InputWrap,
  PageHeader,
  Segmented,
  Table,
} from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import { IconPlus, IconSearch, IconShield } from "@/components/Icon";

const GENDERS = ["Todos", "Masculino", "Femenino", "Mixto"] as const;

export function ClubTeams() {
  const { clubId } = useSession();
  const { data, loading, error } = useAsync(
    () => fetchClubTeams(clubId!),
    [clubId],
    !!clubId
  );
  const all = data ?? [];

  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("Todos");

  const rows = all.filter((t) => {
    if (gender !== "Todos" && (t.gender ?? "").toLowerCase() !== gender.toLowerCase()) return false;
    const q = query.trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q);
  });
  const covered = all.filter((t) => t.covered).length;

  if (loading) return <SkeletonPage />;

  return (
    <div className="tw-page">
      <PageHeader
        title="Equipos"
        lede="Los equipos del club, su categoría y si están cubiertos por el plan."
        actions={
          <BtnLink href="/club/equipos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
            Nuevo equipo
          </BtnLink>
        }
      />

      <div className="tw-toolbar">
        <InputWrap icon={<IconSearch size={15} />}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar equipo"
            aria-label="Buscar equipo"
          />
        </InputWrap>
        <Segmented
          label="Género"
          value={gender}
          onChange={setGender}
          options={GENDERS.map((g) => ({ value: g, label: g }))}
        />
        <span className="tw-toolbar-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          {covered} de {all.length} cubiertos
        </span>
      </div>

      {!clubId ? (
        <Card>
          <EmptyState icon={<IconShield size={22} />} title="Sin club activo" />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState icon={<IconShield size={22} />} title="No se pudieron cargar los equipos" body={error} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconShield size={22} />}
            title={all.length === 0 ? "Aún no hay equipos" : "Sin coincidencias"}
            body={all.length === 0 ? "Da de alta el primero y asígnale un capitán." : "Prueba con otro filtro o nombre."}
            action={
              all.length === 0 ? (
                <BtnLink href="/club/equipos/nuevo" variant="accent" icon={<IconPlus size={14} />}>
                  Crear equipo
                </BtnLink>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card flush>
          <Table>
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Categoría</th>
                <th>Género</th>
                <th>Cobertura</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link
                      href={`/club/equipos/${t.id}`}
                      className="cell-main"
                      style={{ color: "inherit", display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <IconTile small>
                        <IconShield size={14} />
                      </IconTile>
                      <span className="truncate">{t.name}</span>
                    </Link>
                  </td>
                  <td className="cell-muted">
                    {t.category ?? <span style={{ color: "var(--warning)" }}>Sin categoría</span>}
                  </td>
                  <td className="cell-muted">{t.gender ?? "—"}</td>
                  <td>
                    {t.covered ? <Chip>Cubierto</Chip> : <Chip tone="warning">No cubierto</Chip>}
                  </td>
                  <td>
                    <div className="tw-table-actions">
                      <BtnLink href={`/club/equipos/${t.id}`} size="sm" variant="quiet">
                        Gestionar
                      </BtnLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
