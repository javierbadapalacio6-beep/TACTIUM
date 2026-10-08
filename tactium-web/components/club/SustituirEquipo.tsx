"use client";

import { useCallback, useState } from "react";

import {
  buscarSustituto,
  fetchUnlinkedClubTeams,
  type FcpTeamOption,
  type UnlinkedTeam,
} from "@/lib/fcp-import";
import { Btn, Modal } from "@/components/ui";

type Pregunta = {
  fed: FcpTeamOption;
  mio: UnlinkedTeam;
  resolve: (d: "reuse" | "new") => void;
};

/**
 * Anti-duplicados al importar de la Federación — espejo del «Ya tienes un equipo parecido» de
 * la app (`FcpImportSheet.doImport`).
 *
 * Si el usuario ya creó equipos a mano, para cada equipo federado con un candidato SIN vincular
 * (mismo género y categoría) se pregunta si es el mismo: sustituir (vincular + volcar, no se
 * duplica) o crear uno nuevo. Sin esto, importar tras montar el equipo a mano lo duplicaba.
 *
 * Uso:
 *   const { resolver, dialog } = useSustituciones(clubId);
 *   const reuse = await resolver(equiposPropios);   // { fcp_id_equipo → id de tu equipo }
 *   await importFcpTeams(clubId, equiposPropios, "owned", reuse);
 *   …y pintar `{dialog}` en el componente.
 *
 * Solo se pregunta por equipos PROPIOS: un invitado siempre se crea aparte.
 */
export function useSustituciones(clubId: string | null) {
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);

  const resolver = useCallback(
    async (elegidos: FcpTeamOption[]): Promise<Record<number, string>> => {
      let candidatos: UnlinkedTeam[] = [];
      try {
        candidatos = await fetchUnlinkedClubTeams(clubId);
      } catch {
        candidatos = [];
      }
      const reuse: Record<number, string> = {};
      const usados = new Set<string>();
      for (const fed of elegidos) {
        const mio = buscarSustituto(fed, candidatos, usados);
        if (!mio) continue;
        const d = await new Promise<"reuse" | "new">((resolve) =>
          setPregunta({ fed, mio, resolve }),
        );
        setPregunta(null);
        if (d === "reuse") {
          reuse[fed.id_equipo] = mio.id;
          usados.add(mio.id);
        }
      }
      return reuse;
    },
    [clubId],
  );

  const dialog = pregunta ? (
    <Modal
      open
      // Como en la app (`cancelable: false`): hay que elegir una de las dos.
      onClose={() => {}}
      labelledBy="sustituir-equipo-title"
      title="Ya tienes un equipo parecido"
      width={500}
      footer={
        <>
          <Btn onClick={() => pregunta.resolve("new")}>Crear nuevo</Btn>
          <Btn variant="accent" onClick={() => pregunta.resolve("reuse")}>
            Sustituir
          </Btn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12, fontSize: 13.5 }}>
        <div>
          <div style={{ color: "var(--text-faint)", fontSize: 12 }}>Tu equipo (a mano)</div>
          <strong>«{pregunta.mio.name}»</strong>
          {pregunta.mio.group ? <span> · Grupo {pregunta.mio.group}</span> : null}
        </div>
        <div>
          <div style={{ color: "var(--text-faint)", fontSize: 12 }}>Equipo federado</div>
          <strong>«{pregunta.fed.equipo}»</strong>
          {[pregunta.fed.category, pregunta.fed.grupo].filter(Boolean).length > 0 ? (
            <div style={{ color: "var(--text-muted)" }}>
              {[pregunta.fed.category, pregunta.fed.grupo].filter(Boolean).join(" · ")}
            </div>
          ) : null}
        </div>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          ¿Es el mismo?
          <br />· <strong>Sustituir:</strong> le vuelco la plantilla y los resultados oficiales (no
          se duplica).
          <br />· <strong>Crear nuevo:</strong> lo dejo como está y creo otro equipo.
        </p>
      </div>
    </Modal>
  ) : null;

  return { resolver, dialog };
}
