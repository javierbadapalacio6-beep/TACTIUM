// Piezas de interfaz de la publicación automática en la nube: la etiqueta de cada
// tarjeta, el bloque de la ficha, el modal «Programar la semana» y la vista de avisos.
// Las usa publicaciones.js; las acciones van a /api/nube/* del servidor local.
(function () {
  const { useState } = React;
  const TZ = "Europe/Madrid";
  const hm = (iso) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const fechaHora = (iso) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace(",", " a las");
  const conSticker = (p) => p.tipo === "story" && p.sticker && p.sticker !== "Ninguno";
  /** ISO UTC de un día y hora de Madrid (el navegador sabe la zona). */
  const aIso = (fecha, hora) => {
    const [y, m, d] = fecha.split("-").map(Number), [H, M] = hora.split(":").map(Number);
    const guess = Date.UTC(y, m - 1, d, H, M);
    const g = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    return new Date(guess - (Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute) - guess)).toISOString();
  };
  const activa = (f) => f && ["programada", "procesando"].includes(f.estado);

  /** Etiqueta pequeña para la tarjeta del calendario. */
  function NubeChip({ f }) {
    if (!f || f.estado === "cancelada") return null;
    const dm = (iso) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(iso)).replace(".", "");
    const [clase, texto, titulo] =
      f.tipo === "grabacion" ? (f.estado === "avisada" ? ["estado--ok", "Guion enviado", "El guion ya te llegó por Telegram"] : ["estado--nube", `Guion ${dm(f.programada_para)} ${hm(f.programada_para)}`, "Ese día te llega el guion por Telegram"])
      : f.estado === "error" ? ["estado--tarde", "Error al publicar", f.error || ""]
      : f.estado === "publicada" ? ["estado--ok", "Salió sola", "Publicada por la nube"]
      : f.estado === "avisada" ? ["estado--ok", "Aviso enviado", ""]
      : f.tipo === "aviso" ? ["estado--nube", `Aviso ${hm(f.programada_para)}`, "Te llegará un aviso para subirla a mano"]
      : ["estado--nube", `Auto ${hm(f.programada_para)}`, "Se publica sola a esa hora"];
    return html`<span class=${"estado " + clase} title=${titulo}><${Icon} name="cloud" size=${12} />${texto}</span>`;
  }

  /** Bloque «Publicación automática» de la ficha de una pieza. */
  function NubeFicha({ p, f, fg, nube, onAccion }) {
    const [confirmar, setConfirmar] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const hacer = async (accion) => { setOcupado(true); try { await onAccion(accion, p.id); setConfirmar(null); } finally { setOcupado(false); } };

    if (!nube?.configurada) return html`<span class="campo__txt">La nube no está conectada: faltan SUPABASE_URL y la clave de servidor en panel/.env.</span>`;
    if (p.estado === "grabar" && !activa(f)) {
      const guion = fg && fg.estado !== "cancelada"
        ? (fg.estado === "avisada" ? " El guion ya te llegó por Telegram." : ` El guion te llega por Telegram el ${fechaHora(fg.programada_para)}.`)
        : "";
      return html`<span class="campo__txt">Cuando esté grabada y generada, podrás programarla para que salga sola.${guion}</span>`;
    }

    const sticker = conSticker(p);
    const cuandoPlan = p.fecha && p.hora ? fechaHora(aIso(p.fecha, p.hora)) : null;
    const desfasada = activa(f) && p.fecha && p.hora && aIso(p.fecha, p.hora) !== new Date(f.programada_para).toISOString();
    const Boton = ({ accion, texto, icono, osc, peligro }) => html`
      <button type="button" class=${"btn" + (osc ? " btn--osc" : "") + (peligro ? " btn--peligro" : "")} disabled=${ocupado} onClick=${() => setConfirmar(accion)}>
        <${Icon} name=${icono} size=${14} />${texto}
      </button>`;

    const PREGUNTA = {
      programar: sticker
        ? `Te llegará un aviso ${cuandoPlan ? `el ${cuandoPlan}` : ""} con la imagen, para que la subas tú con su sticker.`
        : `Se publicará sola en Instagram el ${cuandoPlan}, con el texto de abajo${p.tipo === "reel" ? " y la versión 16:9 del vídeo" : ""}.`,
      publicar: `Se publica ahora mismo en Instagram, con el texto de abajo${p.tipo === "reel" ? " y la versión 16:9 del vídeo" : ""}. No se puede deshacer desde aquí.`,
      cancelar: "Deja de estar programada: no saldrá sola. Puedes volver a programarla cuando quieras.",
    };
    const SI = { programar: sticker ? "Sí, avisarme" : "Sí, programar", publicar: "Sí, publicar ahora", cancelar: "Sí, cancelar" };

    let texto, botones;
    if (!f || f.estado === "cancelada") {
      texto = sticker
        ? "Instagram no deja poner stickers desde fuera. Si la programas, a su hora te llega un aviso con la imagen para subirla tú."
        : cuandoPlan ? `No está programada. Si la programas, saldrá sola el ${cuandoPlan}.` : "Ponle día y hora arriba para poder programarla.";
      botones = html`
        ${cuandoPlan ? html`<${Boton} accion="programar" texto=${sticker ? "Programar aviso" : "Programar"} icono="cloud" osc=${true} />` : null}
        ${!sticker && p.archivos?.length ? html`<${Boton} accion="publicar" texto="Publicar ahora" icono="send" />` : null}`;
    } else if (activa(f)) {
      texto = f.tipo === "aviso"
        ? `Programada como aviso: te llegará el ${fechaHora(f.programada_para)}.`
        : `Saldrá sola el ${fechaHora(f.programada_para)}. ${f.estado === "procesando" ? "Instagram ya tiene el archivo procesado." : "El archivo se prepara en Instagram una hora antes."}${f.error ? ` Último intento: ${f.error}` : ""}`;
      botones = html`
        ${desfasada ? html`<${Boton} accion="programar" texto="Reprogramar a la nueva hora" icono="clock" osc=${true} />` : null}
        ${f.tipo !== "aviso" ? html`<${Boton} accion="publicar" texto="Publicar ahora" icono="send" />` : null}
        <${Boton} accion="cancelar" texto="Cancelar" icono="close" peligro=${true} />`;
    } else if (f.estado === "error") {
      texto = `No se pudo publicar: ${f.error || "error desconocido"}`;
      botones = html`<${Boton} accion="programar" texto="Reintentar" icono="refresh" osc=${true} /><${Boton} accion="cancelar" texto="Descartar" icono="close" peligro=${true} />`;
    } else if (f.estado === "publicada") {
      texto = `Salió sola el ${fechaHora(f.publicada_at || f.programada_para)}.`;
      botones = f.ig_enlace ? html`<a class="btn" href=${f.ig_enlace} target="_blank" rel="noopener"><${Icon} name="external" size=${14} />Ver en Instagram</a>` : null;
    } else if (f.estado === "avisada") {
      texto = "Aviso enviado. Márcala como publicada cuando la subas.";
      botones = null;
    }

    return html`
      <span class="campo__txt">${texto}</span>
      ${desfasada ? html`<span class="aviso">Has cambiado el día o la hora: la nube sigue con la anterior hasta que la reprogrames.</span>` : null}
      ${confirmar ? html`
        <div class="confirmar" role="alertdialog" aria-label="Confirmar">
          <span>${PREGUNTA[confirmar]}</span>
          <div class="campo__fila">
            <button type="button" class=${"btn " + (confirmar === "cancelar" ? "btn--peligro" : "btn--osc")} disabled=${ocupado} onClick=${() => hacer(confirmar)}>
              ${ocupado ? (confirmar === "publicar" ? "Publicando… puede tardar un minuto" : "Un momento…") : SI[confirmar]}
            </button>
            <button type="button" class="btn" disabled=${ocupado} onClick=${() => setConfirmar(null)}>No</button>
          </div>
        </div>` : html`<div class="campo__fila">${botones}</div>`}`;
  }

  /** Modal: programar de una vez todo lo que esté listo en una semana. */
  function ProgramarSemana({ semana, piezas, filas, onCerrar, onConfirmar }) {
    const [ocupado, setOcupado] = useState(false);
    const ahora = Date.now();
    const filas2 = piezas.filter((p) => p.fecha && p.hora).map((p) => {
      const f = filas[p.id];
      const cuando = new Date(aIso(p.fecha, p.hora)).getTime();
      const motivo =
        p.estado === "publicado" || f?.estado === "publicada" ? "Ya publicada"
        : p.estado === "grabar" ? "Por grabar"
        : activa(f) ? "Ya programada"
        : cuando <= ahora ? "Ya pasó la hora"
        : !p.archivos?.length && !conSticker(p) ? "Sin archivo"
        : null;
      return { p, motivo, como: conSticker(p) ? "Aviso por Telegram (sticker)" : "Se publica sola" };
    });
    const van = filas2.filter((x) => !x.motivo);
    const confirmar = async () => { setOcupado(true); try { await onConfirmar(van.map((x) => x.p.id)); } finally { setOcupado(false); } };
    return html`
      <div class="modal" role="dialog" aria-modal="true" aria-label="Programar la semana" onClick=${(e) => e.target === e.currentTarget && !ocupado && onCerrar()}>
        <div class="modal__box" style=${{ width: 760 }}>
          <div class="modal__head">
            <div><div class="ficha__eyebrow">Semana ${semana.n} · ${semana.titulo}</div><div class="ficha__titulo">Programar en la nube</div></div>
            <button type="button" class="round" style=${{ width: 44, height: 44 }} aria-label="Cerrar" disabled=${ocupado} onClick=${onCerrar}><${Icon} name="close" /></button>
          </div>
          <table class="mes" style=${{ fontSize: 13 }}>
            <tbody>
              ${filas2.map(({ p, motivo, como }) => html`
                <tr key=${p.id}>
                  <td>${new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(new Date(p.fecha + "T12:00:00Z"))}</td>
                  <td class="num">${p.hora}</td>
                  <td><b>${p.id}</b> · ${p.titulo}</td>
                  <td>${motivo ? html`<span class="pz__sticker">${motivo}</span>` : html`<span class=${"estado " + (como.startsWith("Aviso") ? "estado--grabar" : "estado--nube")}>${como}</span>`}</td>
                </tr>`)}
            </tbody>
          </table>
          <div class="campo__txt">${van.length
            ? `Se programan ${van.length} pieza${van.length > 1 ? "s" : ""}. Las que salen solas se publicarán en Instagram a su hora sin que hagas nada; las stories con sticker te llegarán como aviso.`
            : "No queda nada por programar en esta semana."}</div>
          <div class="ficha__acciones">
            <button type="button" class="btn btn--osc" disabled=${!van.length || ocupado} onClick=${confirmar}><${Icon} name="cloud" size=${14} />${ocupado ? "Subiendo archivos…" : `Programar ${van.length}`}</button>
            <button type="button" class="btn" disabled=${ocupado} onClick=${onCerrar}>Cancelar</button>
          </div>
        </div>
      </div>`;
  }

  /** Vista «Avisos»: la cola de lo que va a salir y el historial de avisos. */
  function VistaAvisos({ nube, onAbrir }) {
    if (!nube) return html`<div class="vacio">Cargando la nube…</div>`;
    if (!nube.configurada) return html`<div class="vacio">La nube no está conectada.</div>`;
    const cola = nube.filas.filter(activa);
    const hechas = nube.filas.filter((f) => ["publicada", "avisada", "error"].includes(f.estado)).slice(-8).reverse();
    const fmt = (iso) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
    return html`
      <div class="horas" style=${{ gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)" }}>
        <div class="bloque">
          <div class="bloque__tit">Cola de publicación</div>
          <div class="bloque__sub">Lo que va a salir solo, por orden. La nube lo publica aunque tengas el ordenador apagado.</div>
          ${cola.length ? html`
            <table class="mes" style=${{ fontSize: 13 }}><tbody>
              ${cola.map((f) => html`
                <tr key=${f.pieza} class="fila" onClick=${() => onAbrir(f.pieza)}>
                  <td class="num">${fmt(f.programada_para)}</td>
                  <td><b>${f.pieza}</b> · ${f.titulo}</td>
                  <td><${NubeChip} f=${f} /></td>
                </tr>`)}
            </tbody></table>` : html`<div class="campo__txt">No hay nada programado. Abre una pieza o usa «Programar semana».</div>`}
          ${hechas.length ? html`
            <div class="bloque__tit" style=${{ marginTop: 8 }}>Últimas</div>
            <table class="mes" style=${{ fontSize: 13 }}><tbody>
              ${hechas.map((f) => html`
                <tr key=${f.pieza} class="fila" onClick=${() => onAbrir(f.pieza)}>
                  <td class="num">${fmt(f.publicada_at || f.programada_para)}</td>
                  <td><b>${f.pieza}</b> · ${f.titulo}</td>
                  <td><${NubeChip} f=${f} /></td>
                </tr>`)}
            </tbody></table>` : null}
        </div>
        <div class="bloque">
          <div class="bloque__tit">Avisos</div>
          <div class="bloque__sub">${nube.telegram
            ? "Te llegan por Telegram: qué se ha publicado y qué toca después, y un resumen cada mañana."
            : "Telegram todavía no está conectado: los avisos se guardan aquí y empezarán a llegarte en cuanto lo conectes."}</div>
          ${nube.avisos.length ? nube.avisos.map((a) => html`
            <div key=${a.id} class="aviso-item">
              <div class="aviso-item__cab"><span>${fmt(a.creado)}</span>${a.enviado ? html`<span class="estado estado--ok">Enviado</span>` : html`<span class="estado estado--grabar" title=${a.error || ""}>${a.error === "Telegram sin configurar" || a.error === "WhatsApp sin configurar" ? "Solo aquí" : "No enviado"}</span>`}</div>
              <div class="aviso-item__txt">${a.texto}</div>
              ${a.siguiente ? html`<div class="aviso-item__sig">Siguiente: ${a.siguiente}</div>` : null}
            </div>`) : html`<div class="campo__txt">Todavía no hay avisos: el primero llegará cuando salga la primera publicación.</div>`}
        </div>
      </div>`;
  }

  Object.assign(window, { NubeChip, NubeFicha, ProgramarSemana, VistaAvisos, nubeActiva: activa });
})();
