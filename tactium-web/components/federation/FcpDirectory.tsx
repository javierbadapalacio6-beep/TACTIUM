import Link from "next/link";

import { SectionHead } from "@/components/ui";
import { fcpGroupPath, loadFcpDirectory } from "@/lib/seo/fcp";

/**
 * Directorio de grupos de la Federación, por temporada.
 *
 * Es HTML real renderizado en servidor: la primera vez que un rastreador entra
 * en el explorador encuentra aquí un enlace a cada clasificación. La
 * temporada más reciente va abierta; las anteriores, plegadas pero en el
 * documento, y por tanto enlazadas igual.
 */
export async function FcpDirectory() {
  const seasons = await loadFcpDirectory();
  if (seasons.length === 0) return null;

  return (
    <section className="tw-page tw-fcp-dir" aria-labelledby="fcp-dir-title">
      <SectionHead
        title={<span id="fcp-dir-title">Todos los grupos por temporada</span>}
        sub="Clasificación, jornadas y plantillas de cada grupo de la Liga Cántabra de Pádel."
      />
      {seasons.map((s, i) => (
        <details key={s.temporada} className="tw-fcp-dir-season" open={i === 0}>
          <summary>
            Temporada {s.temporada}
            <span className="count">{s.grupos.length} grupos</span>
          </summary>
          <ul className="tw-fcp-dir-list">
            {s.grupos.map((g) => (
              <li key={g.idGrupo}>
                <Link href={fcpGroupPath(g.idGrupo)}>{g.nombre}</Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
